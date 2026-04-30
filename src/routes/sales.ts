import { Router } from "express";
import { v4 as uuid } from "uuid";
import { deleteItem, getItem, putItem, scanByEntityPrefix, updateItem } from "../db/repo.js";
import type { SalePayment, SaleRecord, SaleReturnRecord, UserRecord } from "../types.js";
import { authMiddleware } from "../middleware/auth.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { notificationManager } from "../sms/index.js";

const now = () => new Date().toISOString();

export const salesRouter = Router();
salesRouter.use(authMiddleware);

async function saleNumber(): Promise<string> {
  const rows = await scanByEntityPrefix("SALE#");
  const sales = rows.filter((r) => (r as SaleRecord).entityType === "SALE") as SaleRecord[];
  let max = 0;
  for (const s of sales) {
    const m = (s.saleNumber ?? "").match(/^IN(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return `IN${String(max + 1).padStart(3, "0")}`;
}

salesRouter.get("/", async (_req, res) => {
  const rows = await scanByEntityPrefix("SALE#");
  const sales = rows.filter((r) => (r as { entityType?: string }).entityType === "SALE");
  res.json({ sales });
});

salesRouter.post("/", async (req: AuthedRequest, res) => {
  const body = req.body as Partial<SaleRecord> & { createdBy?: string; payAmount?: number; payType?: string; payNote?: string };
  if (!body.deliveryDate || !Array.isArray(body.lines)) {
    res.status(400).json({ error: "deliveryDate and lines required" });
    return;
  }

  // Resolve creator name
  let createdBy = body.createdBy ?? "System";
  if (req.userId) {
    const userRec = await getItem(`USER#${req.userId}`, "PROFILE") as UserRecord | undefined;
    if (userRec?.name) createdBy = userRec.name;
  }

  const lines = body.lines || [];
  const subtotal = lines.reduce((s, l) => s + Number(l.lineTotal ?? 0), 0);
  const otherCharges = Number(body.otherCharges ?? 0);
  const discountOnAll = Number(body.discountOnAll ?? 0);
  const roundOff = Number(body.roundOff ?? 0);
  const total = subtotal + otherCharges - discountOnAll + roundOff;

  // Handle initial payment
  const payments: SalePayment[] = [];
  const payAmount = Number(body.payAmount ?? 0);
  if (payAmount > 0 && body.payType) {
    payments.push({
      id: uuid(),
      date: new Date().toISOString().slice(0, 10),
      paymentType: body.payType,
      note: body.payNote,
      amount: payAmount,
    });
  }
  const paidAmount = payments.reduce((s, p) => s + p.amount, 0);
  const paymentStatus = paidAmount <= 0 ? "Unpaid" : paidAmount >= total ? "Paid" : "Partial";

  const id = uuid();
  const rec: SaleRecord = {
    pk: `SALE#${id}`,
    sk: "META",
    entityType: "SALE",
    saleNumber: await saleNumber(),
    customerId: body.customerId,
    customerName: body.customerName,
    customerMobile: body.customerMobile,
    deliveryDate: body.deliveryDate,
    subtotal,
    total,
    paidAmount,
    status: body.status || "Pending",
    paymentStatus,
    otherCharges,
    otherChargesType: body.otherChargesType,
    discountOnAll,
    discountOnAllType: body.discountOnAllType,
    roundOff,
    referenceNo: body.referenceNo,
    note: body.note,
    sendSms: body.sendSms,
    createdBy,
    payments,
    lines,
    createdAt: now(),
    updatedAt: now(),
  };
  await putItem(rec);
  res.status(201).json({ id, ...rec });
});

salesRouter.post("/pos", async (req: AuthedRequest, res) => {
  const body = req.body as {
    customerId?: string;
    customerName?: string;
    customerMobile?: string;
    deliveryDate: string;
    status?: string;
    otherCharges?: number;
    lines: SaleRecord["lines"];
    payments?: SalePayment[];
    sendSms?: boolean;
  };
  if (!body.deliveryDate || !Array.isArray(body.lines)) {
    res.status(400).json({ error: "deliveryDate and lines required" });
    return;
  }

  // Resolve creator name from JWT
  let createdBy = "System";
  if (req.userId) {
    const userRec = await getItem(`USER#${req.userId}`, "PROFILE") as UserRecord | undefined;
    if (userRec?.name) createdBy = userRec.name;
  }

  const linesTotal = body.lines.reduce((s, l) => s + Number(l.lineTotal ?? 0), 0);
  const total = linesTotal + Number(body.otherCharges ?? 0);
  const payments: SalePayment[] = body.payments ?? [];
  const paidAmount = payments.reduce((s, p) => s + p.amount, 0);
  const paymentStatus = paidAmount <= 0 ? "Unpaid" : paidAmount >= total ? "Paid" : "Partial";

  const id = uuid();
  const rec: SaleRecord = {
    pk: `SALE#${id}`,
    sk: "META",
    entityType: "SALE",
    saleNumber: await saleNumber(),
    customerId: body.customerId,
    customerName: body.customerName,
    customerMobile: body.customerMobile,
    deliveryDate: body.deliveryDate,
    total,
    subtotal: linesTotal,
    paidAmount,
    status: body.status ?? "Pending",
    paymentStatus,
    otherCharges: Number(body.otherCharges ?? 0),
    createdBy,
    payments,
    lines: body.lines,
    createdAt: now(),
    updatedAt: now(),
  };
  await putItem(rec);

  // Fire "order placed" SMS if requested
  if (body.sendSms && body.customerMobile) {
    notificationManager.fire("JOB_PLACED", body.customerMobile, {
      customer_name: body.customerName ?? "Valued Customer",
      job_id: rec.saleNumber,
      delivery_date: body.deliveryDate,
    }).catch((err) => console.error("[SMS] POS placed:", err));
  }

  res.status(201).json({ id, ...rec });
});

salesRouter.get("/returns/list", async (_req, res) => {
  const rows = await scanByEntityPrefix("SALE_RETURN#");
  res.json({ returns: rows });
});

salesRouter.post("/returns", async (req, res) => {
  const body = req.body as { originalSaleId?: string; total: number; reason?: string };
  if (body.total == null) {
    res.status(400).json({ error: "total required" });
    return;
  }
  const id = uuid();
  const rec: SaleReturnRecord = {
    pk: `SALE_RETURN#${id}`,
    sk: "META",
    entityType: "SALE_RETURN",
    originalSaleId: body.originalSaleId,
    total: Number(body.total),
    reason: body.reason,
    createdAt: now(),
    updatedAt: now(),
  };
  await putItem(rec);
  res.status(201).json({ id, ...rec });
});

salesRouter.get("/:id", async (req, res) => {
  const row = await getItem(`SALE#${req.params.id}`, "META");
  if (!row || (row as SaleRecord).entityType !== "SALE") {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(row);
});

/** GET /api/sales/:id/payments */
salesRouter.get("/:id/payments", async (req, res) => {
  const row = await getItem(`SALE#${req.params.id}`, "META") as SaleRecord | undefined;
  if (!row || row.entityType !== "SALE") {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ payments: row.payments ?? [], paidAmount: row.paidAmount ?? 0, total: row.total, paymentStatus: row.paymentStatus });
});

/** POST /api/sales/:id/payments */
salesRouter.post("/:id/payments", async (req, res) => {
  const existing = await getItem(`SALE#${req.params.id}`, "META") as SaleRecord | undefined;
  if (!existing || existing.entityType !== "SALE") {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const { amount, paymentType, date, note } = req.body as { amount?: number; paymentType?: string; date?: string; note?: string };
  if (!amount || !paymentType) {
    res.status(400).json({ error: "amount and paymentType required" });
    return;
  }
  const newPayment: SalePayment = {
    id: uuid(),
    date: date ?? new Date().toISOString().slice(0, 10),
    paymentType,
    note,
    amount: Number(amount),
  };
  const payments = [...(existing.payments ?? []), newPayment];
  const paidAmount = payments.reduce((s, p) => s + p.amount, 0);
  const paymentStatus = paidAmount <= 0 ? "Unpaid" : paidAmount >= existing.total ? "Paid" : "Partial";
  await updateItem(`SALE#${req.params.id}`, "META", { payments, paidAmount, paymentStatus, updatedAt: now() });
  res.json({ payment: newPayment, paidAmount, paymentStatus });
});

/** DELETE /api/sales/:id/payments/:paymentId */
salesRouter.delete("/:id/payments/:paymentId", async (req, res) => {
  const existing = await getItem(`SALE#${req.params.id}`, "META") as SaleRecord | undefined;
  if (!existing || existing.entityType !== "SALE") {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const payments = (existing.payments ?? []).filter((p) => p.id !== req.params.paymentId);
  const paidAmount = payments.reduce((s, p) => s + p.amount, 0);
  const paymentStatus = paidAmount <= 0 ? "Unpaid" : paidAmount >= existing.total ? "Paid" : "Partial";
  await updateItem(`SALE#${req.params.id}`, "META", { payments, paidAmount, paymentStatus, updatedAt: now() });
  res.json({ ok: true, paidAmount, paymentStatus });
});

/** PUT /api/sales/:id — edit a sale */
salesRouter.put("/:id", async (req: AuthedRequest, res) => {
  const existing = await getItem(`SALE#${req.params.id}`, "META") as SaleRecord | undefined;
  if (!existing || existing.entityType !== "SALE") {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const body = req.body as Partial<SaleRecord>;
  const lines = body.lines ?? existing.lines;
  const subtotal = lines.reduce((s, l) => s + Number(l.lineTotal ?? 0), 0);
  const otherCharges = Number(body.otherCharges ?? existing.otherCharges ?? 0);
  const discountOnAll = Number(body.discountOnAll ?? existing.discountOnAll ?? 0);
  const roundOff = Number(body.roundOff ?? existing.roundOff ?? 0);
  const total = subtotal + otherCharges - discountOnAll + roundOff;
  const paidAmount = existing.paidAmount ?? 0;
  const paymentStatus = paidAmount <= 0 ? "Unpaid" : paidAmount >= total ? "Paid" : "Partial";
  const updates: Partial<SaleRecord> = {
    customerId: body.customerId ?? existing.customerId,
    customerName: body.customerName ?? existing.customerName,
    customerMobile: body.customerMobile ?? existing.customerMobile,
    deliveryDate: body.deliveryDate ?? existing.deliveryDate,
    status: body.status ?? existing.status,
    referenceNo: body.referenceNo ?? existing.referenceNo,
    note: body.note ?? existing.note,
    otherCharges,
    otherChargesType: body.otherChargesType ?? existing.otherChargesType,
    discountOnAll,
    discountOnAllType: body.discountOnAllType ?? existing.discountOnAllType,
    roundOff,
    subtotal,
    total,
    paymentStatus,
    lines,
    updatedAt: now(),
  };
  await updateItem(`SALE#${req.params.id}`, "META", updates);
  res.json({ ok: true, ...existing, ...updates });
});

/**
 * PATCH /api/sales/:id/status
 * Update a sale's status and fire an SMS notification to the customer.
 * Body: { status: string, customerPhone?: string, customerName?: string }
 */
salesRouter.patch("/:id/status", async (req, res) => {
  const { status, customerPhone, customerName } = req.body as {
    status?: string;
    customerPhone?: string;
    customerName?: string;
  };

  if (!status) {
    res.status(400).json({ error: "status is required" });
    return;
  }

  const existing = await getItem(`SALE#${req.params.id}`, "META") as SaleRecord | undefined;
  if (!existing || existing.entityType !== "SALE") {
    res.status(404).json({ error: "Not found" });
    return;
  }

  await updateItem(`SALE#${req.params.id}`, "META", {
    status,
    updatedAt: now(),
  });

  // Fire SMS — non-blocking, errors are logged inside the manager
  notificationManager.onJobStatusChange(
    status,
    customerPhone,
    {
      customer_name: customerName ?? existing.customerName ?? "Valued Customer",
      job_id:        existing.saleNumber,
      delivery_date: existing.deliveryDate ?? "—",
    }
  ).catch((err) => console.error("[SMS] Unhandled error:", err));

  res.json({ ok: true, status });
});

/**
 * POST /api/sales/:id/send-sms
 * Manually send a delivery SMS to the customer for a given sale.
 * Fires the JOB_COMPLETED template (delivery notification).
 */
salesRouter.post("/:id/send-sms", async (req, res) => {
  const existing = await getItem(`SALE#${req.params.id}`, "META") as SaleRecord | undefined;
  if (!existing || existing.entityType !== "SALE") {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const phone = existing.customerMobile;
  if (!phone) {
    res.status(400).json({ error: "No customer mobile number on this sale" });
    return;
  }

  try {
    await notificationManager.fire("JOB_COMPLETED", phone, {
      customer_name: existing.customerName ?? "Valued Customer",
      job_id:        existing.saleNumber,
      delivery_date: existing.deliveryDate ?? "—",
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("[SMS] Manual send-sms error:", err);
    res.status(500).json({ error: "Failed to send SMS" });
  }
});

salesRouter.delete("/:id", async (req, res) => {
  await deleteItem(`SALE#${req.params.id}`, "META");
  res.json({ ok: true });
});
