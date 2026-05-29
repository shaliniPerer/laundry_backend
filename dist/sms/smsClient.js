/**
 * @deprecated
 * Use `gateway` from "./gateway/smsGateway.js" or import from "../sms/index.js".
 * This file is kept as a thin backward-compatibility shim.
 */
import { gateway } from "./gateway/smsGateway.js";
/** @deprecated Use gateway.send() instead */
export async function sendSms(phone, message, opts = {}) {
    const r = await gateway.send(phone, message, opts);
    return { success: r.success, messageId: r.messageId, error: r.error };
}
