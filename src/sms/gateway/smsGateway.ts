/**
 * SMS Gateway Service
 * ────────────────────
 * Clean, decoupled abstraction over any REST SMS provider.
 * The rest of the application never talks directly to a provider — it
 * always goes through this gateway, keeping provider-specific code in
 * one place.
 *
 * Supported providers (set via SMS_PROVIDER env var):
 *   getapi    – GET-based API (DEFAULT)
 *               GET {SMS_BASE_URL}/api/mt/SendSMS?
 *                   APIKey={SMS_API_KEY}&senderid={SMS_SENDER_ID}&
 *                   channel=2&DCS=0&flashsms=0&mobiles={phone}&
 *                   message={url-encoded-message}&route=1
 *   generic   – JSON POST + Bearer token (Vonage, Africa's Talking, Termii, etc.)
 *   twilio    – Twilio REST API (Basic Auth, form-encoded body)
 *   notifylk  – Notify.lk API (JSON POST with user_id + api_key)
 *
 * Every outbound message — whether sent or failed — is persisted to
 * DynamoDB to give a full Sent History log.
 */

import { v4 as uuid } from "uuid";
import { putItem } from "../../db/repo.js";
import { config } from "../../config.js";

// ── Public Types ──────────────────────────────────────────────────────────────

export interface GatewaySendOptions {
  /** Override the default sender ID for this single message */
  senderId?: string;
  /** Tag the DynamoDB log entry with the event that triggered this send */
  eventType?: string;
}

export interface GatewaySendResult {
  success: boolean;
  messageId: string;
  provider: string;
  error?: string;
}

// ── Dev-mode Detection ────────────────────────────────────────────────────────

function isDevMode(provider: string): boolean {
  const { smsBaseUrl, smsApiUrl, smsApiKey, notifylkUserId, twilioAccountSid } = config.sms;
  switch (provider) {
    case "getapi":   return !smsBaseUrl    || !smsApiKey;
    case "twilio":   return !twilioAccountSid || !smsApiKey;
    case "notifylk": return !notifylkUserId   || !smsApiKey;
    default:         return !smsApiUrl        || !smsApiKey;
  }
}

// ── Phone Number Normalizer ───────────────────────────────────────────────────
/**
 * Normalises any common Sri Lanka phone number format to the
 * 11-digit numeric string Notify.lk (and most providers) require.
 *
 * Accepted inputs → output (all → "94779209217"):
 *   "077 9209217"   (local with space)
 *   "0779209217"    (local, no space)
 *   "+94779209217"  (E.164 with +)
 *   "0094779209217" (international dial-out prefix)
 *   "779209217"     (9-digit, no leading 0)
 *   "94779209217"   (already correct)
 */
function normalizePhone(raw: string): string {
  // 1. Strip every character that isn't a digit
  let digits = raw.replace(/\D/g, "");

  // 2. Remove leading international dial-out prefix "00" (e.g. 0094...)
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  // 3. Now handle remaining formats:
  if (digits.startsWith("94") && digits.length === 11) {
    // Already in correct format: 94XXXXXXXXX
    return digits;
  }

  if (digits.startsWith("0") && digits.length === 10) {
    // Local format: 07XXXXXXXX  →  drop leading 0, prepend 94
    return "94" + digits.slice(1);
  }

  if (!digits.startsWith("94") && digits.length === 9) {
    // Bare local number without leading 0: 7XXXXXXXX  →  prepend 94
    return "94" + digits;
  }

  // 4. Fallback: return whatever we have (gateway will surface the error)
  return digits;
}

// ── Provider Adapters ─────────────────────────────────────────────────────────

/**
 * GET-based SMS API adapter.
 *
 * Constructs the URL:
 *   {baseUrl}/api/mt/SendSMS?APIKey=…&senderid=…&channel=2&DCS=0
 *                            &flashsms=0&mobiles=…&message=…&route=1
 *
 * The `message` parameter is URL-encoded via encodeURIComponent so that
 * special characters, spaces, and Unicode are transmitted safely.
 */
async function sendGetApi(
  phone: string,
  message: string,
  senderId: string
): Promise<{ ok: boolean; error?: string }> {
  const { smsBaseUrl, smsApiKey } = config.sms;

  const params = new URLSearchParams({
    APIKey:   smsApiKey,
    senderid: senderId,
    channel:  "2",
    DCS:      "0",
    flashsms: "0",
    mobiles:  phone,
    message:  message,   // URLSearchParams handles encoding automatically
    route:    "1",
  });

  const url = `${smsBaseUrl.replace(/\/$/, "")}/api/mt/SendSMS?${params.toString()}`;

  const res = await fetch(url, { method: "GET" });
  if (res.ok) return { ok: true };
  const text = await res.text();
  return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
}

async function sendGeneric(
  phone: string,
  message: string,
  senderId: string
): Promise<{ ok: boolean; error?: string }> {
  const { smsApiUrl, smsApiKey } = config.sms;
  const res = await fetch(smsApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${smsApiKey}`,
    },
    body: JSON.stringify({ to: phone, from: senderId, body: message }),
  });
  if (res.ok) return { ok: true };
  const text = await res.text();
  return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
}

async function sendTwilio(
  phone: string,
  message: string,
  senderId: string
): Promise<{ ok: boolean; error?: string }> {
  const { smsApiKey, smsApiUrl, twilioAccountSid } = config.sms;
  const url =
    smsApiUrl ||
    `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
  // Twilio uses HTTP Basic Auth: AccountSid:AuthToken
  const credentials = Buffer.from(`${twilioAccountSid}:${smsApiKey}`).toString("base64");
  const body = new URLSearchParams({ To: phone, From: senderId, Body: message });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: body.toString(),
  });
  if (res.ok) return { ok: true };
  const text = await res.text();
  return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
}

async function sendNotifyLk(
  phone: string,
  message: string,
  senderId: string
): Promise<{ ok: boolean; error?: string }> {
  const { notifylkUserId, smsApiKey } = config.sms;
  const res = await fetch("https://app.notify.lk/api/v1/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id:   notifylkUserId,
      api_key:   smsApiKey,
      sender_id: senderId,
      to:        phone,
      message,
    }),
  });

  const text = await res.text();

  // Notify.lk returns HTTP 200 even for API-level errors.
  // The real result is in the JSON body: { status: "success" | "error", message: "..." }
  if (!res.ok) {
    return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
  }

  try {
    const json = JSON.parse(text) as { status?: string; message?: string };
    if (json.status === "success") return { ok: true };
    return { ok: false, error: json.message ?? text.slice(0, 200) };
  } catch {
    // If body isn't JSON, treat HTTP 200 as success
    return { ok: true };
  }
}

// ── Persistence ───────────────────────────────────────────────────────────────

async function logToDb(opts: {
  id: string;
  phone: string;
  message: string;
  status: string;
  provider: string;
  createdAt: string;
  eventType?: string;
  error?: string;
}): Promise<void> {
  await putItem({
    pk: `SMS#${opts.id}`,
    sk: "META",
    entityType: "SMS",
    phone:    opts.phone,
    message:  opts.message,
    status:   opts.status,
    provider: opts.provider,
    ...(opts.eventType ? { eventType: opts.eventType } : {}),
    ...(opts.error     ? { error: opts.error }         : {}),
    createdAt:  opts.createdAt,
    updatedAt:  opts.createdAt,
  });
}

// ── Gateway Class ─────────────────────────────────────────────────────────────

class SmsGateway {
  /**
   * Send a single SMS via the configured provider.
   * The result is always persisted to DynamoDB regardless of success/failure.
   */
  async send(
    phone: string,
    message: string,
    opts: GatewaySendOptions = {}
  ): Promise<GatewaySendResult> {
    const { provider: rawProvider, smsSenderId } = config.sms;
    const provider = rawProvider || "generic";
    const senderId = opts.senderId ?? smsSenderId;
    const id       = uuid();
    const now      = new Date().toISOString();

    // ── Normalise phone number ────────────────────────────────────────
    const normalizedPhone = normalizePhone(phone);
    if (normalizedPhone !== phone) {
      console.log(`[SMS Gateway] Phone normalised: "${phone}" → "${normalizedPhone}"`);
    }

    // ── Dev / offline mode ────────────────────────────────────────────
    if (isDevMode(provider)) {
      await logToDb({ id, phone: normalizedPhone, message, status: "dev-logged", provider: "dev", createdAt: now, eventType: opts.eventType });
      console.log(`[SMS DEV | ${opts.eventType ?? "manual"}] → ${normalizedPhone}: ${message}`);
      return { success: true, messageId: id, provider: "dev" };
    }

    // ── Live send ─────────────────────────────────────────────────────
    let result: { ok: boolean; error?: string };
    try {
      switch (provider) {
        case "getapi":   result = await sendGetApi(normalizedPhone, message, senderId);    break;
        case "twilio":   result = await sendTwilio(normalizedPhone, message, senderId);    break;
        case "notifylk": result = await sendNotifyLk(normalizedPhone, message, senderId);  break;
        default:         result = await sendGeneric(normalizedPhone, message, senderId);
      }
    } catch (err) {
      result = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }

    const status = result.ok ? "sent" : "failed";
    await logToDb({ id, phone: normalizedPhone, message, status, provider, createdAt: now, eventType: opts.eventType, error: result.error });

    if (!result.ok) {
      console.error(`[SMS Gateway | ${provider}] Failed → ${normalizedPhone}: ${result.error}`);
      return { success: false, messageId: id, provider, error: result.error };
    }

    return { success: true, messageId: id, provider };
  }
}

/** Singleton gateway instance — the single exit-point for all outgoing SMS */
export const gateway = new SmsGateway();
