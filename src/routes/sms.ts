import { Router } from "express";
import { v4 as uuid } from "uuid";
import {
  putItem, scanByEntityPrefix, getItem, deleteItem, updateItem,
} from "../db/repo.js";
import type { SmsRecord, SmsEventRecord, SmsTemplateRecord } from "../types.js";
import { authMiddleware } from "../middleware/auth.js";
import {
  gateway,
  notificationManager,
  TEMPLATE_REGISTRY,
  renderTemplate,
  extractShortCodes,
} from "../sms/index.js";
import type { EventType, TemplateData } from "../sms/index.js";

const now = () => new Date().toISOString();

export const smsRouter = Router();
smsRouter.use(authMiddleware);

// helpers

async function loadDbTemplateMap(): Promise<Record<string, SmsTemplateRecord>> {
  const rows = (await scanByEntityPrefix("SMSTEMPLATE#")) as SmsTemplateRecord[];
  const map: Record<string, SmsTemplateRecord> = {};
  for (const r of rows) { if (r.templateId) map[r.templateId] = r; }
  return map;
}

async function templateExists(templateId: string, dbMap: Record<string, SmsTemplateRecord>): Promise<boolean> {
  if (TEMPLATE_REGISTRY[templateId as keyof typeof TEMPLATE_REGISTRY]) return true;
  if (dbMap[templateId]) return true;
  return false;
}

// ── Message Log ───────────────────────────────────────────────────────────────

smsRouter.get("/", async (_req, res) => {
  const rows = await scanByEntityPrefix("SMS#");
  const sorted = rows.sort((a, b) =>
    ((b as SmsRecord).createdAt ?? "").localeCompare((a as SmsRecord).createdAt ?? "")
  );
  res.json({ messages: sorted });
});

smsRouter.post("/", async (req, res) => {
  const { phone, message } = req.body as { phone?: string; message?: string };
  if (!phone || !message) { res.status(400).json({ error: "phone and message required" }); return; }
  const id = uuid();
  const rec: SmsRecord = {
    pk: `SMS#${id}`, sk: "META", entityType: "SMS",
    phone, message, status: "queued", createdAt: now(), updatedAt: now(),
  };
  await putItem(rec);
  await gateway.send(phone, message, { eventType: "manual" });
  res.status(201).json({ id, ...rec });
});

// ── Templates ─────────────────────────────────────────────────────────────────

/**
 * GET /api/sms/templates
 * Merges static TEMPLATE_REGISTRY (with any DB overrides) + custom DB templates.
 */
smsRouter.get("/templates", async (_req, res) => {
  const dbMap = await loadDbTemplateMap();

  const systemTemplates = Object.values(TEMPLATE_REGISTRY).map((tpl) => {
    const override = dbMap[tpl.id];
    const effectiveBody = override?.body ?? tpl.body;
    return {
      id: tpl.id, name: tpl.name, category: tpl.category, description: tpl.description,
      body: effectiveBody, defaultBody: tpl.body,
      shortCodes: extractShortCodes(effectiveBody),
      isCustomized: !!override?.body,
      isCustom: false,
    };
  });

  const customTemplates = Object.values(dbMap)
    .filter((r) => r.isCustom === true)
    .map((r) => ({
      id: r.templateId, name: r.name, category: r.category, description: r.description,
      body: r.body, defaultBody: undefined,
      shortCodes: extractShortCodes(r.body),
      isCustomized: false,
      isCustom: true,
    }));

  res.json({ templates: [...systemTemplates, ...customTemplates] });
});

/**
 * POST /api/sms/templates — create a new custom template
 * Body: { name, category, description?, body }
 */
smsRouter.post("/templates", async (req, res) => {
  const { name, category, description, body } = req.body as {
    name?: string; category?: "realtime" | "scheduled" | "campaign";
    description?: string; body?: string;
  };
  if (!name?.trim() || !body?.trim()) {
    res.status(400).json({ error: "name and body are required" }); return;
  }
  if (!["realtime", "scheduled", "campaign"].includes(category ?? "")) {
    res.status(400).json({ error: "category must be: realtime | scheduled | campaign" }); return;
  }
  const templateId = uuid();
  const ts = now();
  const rec: SmsTemplateRecord = {
    pk: `SMSTEMPLATE#${templateId}`, sk: "META", entityType: "SMS_TEMPLATE",
    templateId, name: name.trim(), category: category!,
    description: description?.trim(), body: body.trim(),
    isCustom: true, createdAt: ts, updatedAt: ts,
  };
  await putItem(rec as unknown as Record<string, unknown>);
  res.status(201).json({ id: templateId, ...rec });
});

/**
 * PUT /api/sms/templates/:id — update body (+ name/category/description for custom)
 */
smsRouter.put("/templates/:id", async (req, res) => {
  const { id } = req.params;
  const { body, name, category, description } = req.body as {
    body?: string; name?: string;
    category?: "realtime" | "scheduled" | "campaign"; description?: string;
  };
  if (!body?.trim()) { res.status(400).json({ error: "body is required" }); return; }

  const dbMap = await loadDbTemplateMap();
  const isCustom = dbMap[id]?.isCustom === true;
  const isSystem = !!TEMPLATE_REGISTRY[id as keyof typeof TEMPLATE_REGISTRY];
  if (!isCustom && !isSystem) {
    res.status(404).json({ error: `Unknown template id: ${id}` }); return;
  }

  if (isCustom) {
    const updates: Record<string, unknown> = { body: body.trim(), updatedAt: now() };
    if (name?.trim())              updates.name        = name.trim();
    if (category)                  updates.category    = category;
    if (description !== undefined) updates.description = description?.trim() ?? null;
    await updateItem(`SMSTEMPLATE#${id}`, "META", updates);
  } else {
    const ts = now();
    const existing = dbMap[id];
    const sysTpl = TEMPLATE_REGISTRY[id as EventType];
    const rec: SmsTemplateRecord = {
      pk: `SMSTEMPLATE#${id}`, sk: "META", entityType: "SMS_TEMPLATE", templateId: id,
      name:        existing?.name ?? sysTpl?.name ?? id,
      category:    existing?.category ?? sysTpl?.category ?? "realtime",
      description: existing?.description ?? sysTpl?.description,
      body:        body.trim(), isCustom: false,
      createdAt:   existing?.createdAt ?? ts, updatedAt: ts,
    };
    await putItem(rec as unknown as Record<string, unknown>);
  }
  res.json({ ok: true, id });
});

/**
 * DELETE /api/sms/templates/:id
 * System → remove DB override. Custom → full delete (blocked if events reference it).
 */
smsRouter.delete("/templates/:id", async (req, res) => {
  const { id } = req.params;
  const dbMap = await loadDbTemplateMap();
  if (dbMap[id]?.isCustom === true) {
    const events = (await scanByEntityPrefix("SMSEVENT#")) as Array<{ templateId?: string; eventType?: string }>;
    if (events.some((e) => (e.templateId ?? e.eventType) === id)) {
      res.status(409).json({ error: "Cannot delete: events are linked to this template. Delete those events first." });
      return;
    }
  }
  await deleteItem(`SMSTEMPLATE#${id}`, "META");
  res.json({ ok: true });
});

// ── Preview / Fire ────────────────────────────────────────────────────────────

smsRouter.post("/preview", async (req, res) => {
  const id: string | undefined = req.body.templateId ?? req.body.eventType;
  const data: TemplateData = req.body.data ?? {};
  if (!id) { res.status(400).json({ error: "templateId required" }); return; }

  const dbMap = await loadDbTemplateMap();
  const dbRecord = dbMap[id];
  const systemTpl = TEMPLATE_REGISTRY[id as EventType];
  const effectiveBody = dbRecord?.body ?? systemTpl?.body;
  if (!effectiveBody) { res.status(404).json({ error: `No template found: ${id}` }); return; }

  const preview = effectiveBody.replace(/\{(\w+)\}/g, (_m, k: string) => {
    const val = data[k];
    return val !== undefined && val !== null ? String(val) : `{${k}}`;
  });
  res.json({ preview, id, name: dbRecord?.name ?? systemTpl?.name ?? id });
});

smsRouter.post("/fire", async (req, res) => {
  const id: string | undefined = req.body.templateId ?? req.body.eventType;
  const { phone, data } = req.body as { phone?: string; data?: TemplateData };
  if (!id || !phone) { res.status(400).json({ error: "templateId and phone required" }); return; }
  await notificationManager.fire(id, phone, data ?? {});
  res.json({ ok: true, templateId: id, phone });
});

// ── Events ────────────────────────────────────────────────────────────────────

/**
 * GET /api/sms/events
 * Returns all DB events with the resolved templateName for display.
 */
smsRouter.get("/events", async (_req, res) => {
  const [rows, dbMap] = await Promise.all([
    scanByEntityPrefix("SMSEVENT#"),
    loadDbTemplateMap(),
  ]);
  const events = (rows as Array<Record<string, unknown>>).map((r) => {
    const templateId = (r.templateId as string | undefined) ?? (r.eventType as string | undefined) ?? "";
    const systemTpl  = TEMPLATE_REGISTRY[templateId as EventType];
    const dbTpl      = dbMap[templateId];
    return { ...r, templateId, templateName: dbTpl?.name ?? systemTpl?.name ?? templateId };
  });
  res.json({ events });
});

/**
 * POST /api/sms/events — create an event
 * Body: { label, date (MM-DD), templateId, promoCode? }
 */
smsRouter.post("/events", async (req, res) => {
  const { label, date, templateId, promoCode } = req.body as {
    label?: string; date?: string; templateId?: string; promoCode?: string;
  };
  if (!label?.trim() || !date?.trim() || !templateId?.trim()) {
    res.status(400).json({ error: "label, date (MM-DD), and templateId are required" }); return;
  }
  if (!/^\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: "date must be in MM-DD format (e.g. 06-15)" }); return;
  }
  const dbMap = await loadDbTemplateMap();
  if (!(await templateExists(templateId, dbMap))) {
    res.status(400).json({ error: `No template found with id: "${templateId}"` }); return;
  }
  const id = uuid();
  const ts = now();
  const rec: SmsEventRecord = {
    pk: `SMSEVENT#${id}`, sk: "META", entityType: "SMS_EVENT",
    label: label.trim(), date: date.trim(), templateId: templateId.trim(),
    ...(promoCode?.trim() ? { promoCode: promoCode.trim() } : {}),
    createdAt: ts, updatedAt: ts,
  };
  await putItem(rec as unknown as Record<string, unknown>);
  res.status(201).json({ id, ...rec });
});

/**
 * PUT /api/sms/events/:id — update an event
 * Body: { label?, date?, templateId?, promoCode? }
 */
smsRouter.put("/events/:id", async (req, res) => {
  const { label, date, templateId, promoCode } = req.body as {
    label?: string; date?: string; templateId?: string; promoCode?: string | null;
  };
  if (date && !/^\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: "date must be in MM-DD format" }); return;
  }
  if (templateId) {
    const dbMap = await loadDbTemplateMap();
    if (!(await templateExists(templateId, dbMap))) {
      res.status(400).json({ error: `No template found with id: "${templateId}"` }); return;
    }
  }
  const updates: Record<string, unknown> = { updatedAt: now() };
  if (label?.trim())           updates.label      = label.trim();
  if (date?.trim())            updates.date       = date.trim();
  if (templateId?.trim())      updates.templateId = templateId.trim();
  if (promoCode !== undefined) updates.promoCode  = promoCode?.trim() ?? null;
  await updateItem(`SMSEVENT#${req.params.id}`, "META", updates);
  res.json({ ok: true });
});

smsRouter.delete("/events/:id", async (req, res) => {
  await deleteItem(`SMSEVENT#${req.params.id}`, "META");
  res.json({ ok: true });
});

// ── Customers ─────────────────────────────────────────────────────────────────

smsRouter.get("/customers", async (_req, res) => {
  const all = await scanByEntityPrefix("CUSTOMER#");
  const customers = all
    .filter((c) => {
      const r = c as { mobile?: string; phone?: string; entityType?: string };
      return r.entityType === "CUSTOMER" && (r.mobile || r.phone);
    })
    .map((c) => {
      const r = c as { pk: string; name?: string; customerNumber?: string; mobile?: string; phone?: string; dob?: string; status?: string };
      return { pk: r.pk, customerNumber: r.customerNumber, name: r.name, phone: r.mobile || r.phone, dob: r.dob, status: r.status };
    });
  res.json({ customers });
});
