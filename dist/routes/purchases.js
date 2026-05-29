import { Router } from "express";
import { v4 as uuid } from "uuid";
import { deleteItem, putItem, scanByEntityPrefix, updateItem } from "../db/repo.js";
import { authMiddleware } from "../middleware/auth.js";
const now = () => new Date().toISOString();
export const purchasesRouter = Router();
purchasesRouter.use(authMiddleware);
/* ─── Purchases ─────────────────────────────────────────── */
purchasesRouter.get("/", async (_req, res) => {
    const rows = await scanByEntityPrefix("PURCHASE#");
    res.json({ purchases: rows });
});
purchasesRouter.post("/", async (req, res) => {
    const b = req.body;
    const existing = await scanByEntityPrefix("PURCHASE#");
    const count = existing.filter((r) => r.entityType === "PURCHASE").length + 1;
    const purchaseCode = `PO${String(count).padStart(4, "0")}`;
    const id = uuid();
    const lines = b.lines || [];
    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    const otherCharges = b.otherCharges != null ? Number(b.otherCharges) : 0;
    const discountOnAll = b.discountOnAll != null ? Number(b.discountOnAll) : 0;
    const roundOff = b.roundOff != null ? Number(b.roundOff) : 0;
    const total = subtotal + otherCharges - discountOnAll + roundOff;
    const rec = {
        pk: `PURCHASE#${id}`,
        sk: "META",
        entityType: "PURCHASE",
        purchaseCode,
        supplierId: b.supplierId,
        supplierName: b.supplierName,
        purchaseDate: b.purchaseDate || now(),
        status: b.status || "Received",
        referenceNo: b.referenceNo,
        subtotal,
        otherCharges,
        otherChargesType: b.otherChargesType,
        discountOnAll,
        discountOnAllType: b.discountOnAllType,
        roundOff,
        total,
        note: b.note,
        paymentStatus: b.paymentStatus || "Unpaid",
        createdBy: b.createdBy,
        lines,
        createdAt: now(),
        updatedAt: now(),
    };
    await putItem(rec);
    res.status(201).json({ id, ...rec });
});
purchasesRouter.patch("/:id", async (req, res) => {
    const id = req.params.id;
    const b = req.body;
    const updates = { updatedAt: now() };
    const allowed = ["supplierId", "supplierName", "purchaseDate", "status", "referenceNo", "subtotal", "otherCharges", "otherChargesType", "discountOnAll", "discountOnAllType", "roundOff", "total", "note", "paymentStatus", "createdBy", "lines"];
    for (const k of allowed) {
        if (b[k] !== undefined)
            updates[k] = b[k];
    }
    await updateItem(`PURCHASE#${id}`, "META", updates);
    res.json({ ok: true });
});
purchasesRouter.delete("/:id", async (req, res) => {
    await deleteItem(`PURCHASE#${req.params.id}`, "META");
    res.json({ ok: true });
});
/* ─── Purchase Returns ───────────────────────────────────── */
purchasesRouter.get("/returns/list", async (_req, res) => {
    const rows = await scanByEntityPrefix("PURCHASE_RETURN#");
    res.json({ returns: rows });
});
purchasesRouter.post("/returns", async (req, res) => {
    const b = req.body;
    const existing = await scanByEntityPrefix("PURCHASE_RETURN#");
    const count = existing.filter((r) => r.entityType === "PURCHASE_RETURN").length + 1;
    const purchaseReturnCode = `PR${String(count).padStart(4, "0")}`;
    const id = uuid();
    const lines = b.lines || [];
    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    const otherCharges = b.otherCharges != null ? Number(b.otherCharges) : 0;
    const discountOnAll = b.discountOnAll != null ? Number(b.discountOnAll) : 0;
    const roundOff = b.roundOff != null ? Number(b.roundOff) : 0;
    const total = subtotal + otherCharges - discountOnAll + roundOff;
    const rec = {
        pk: `PURCHASE_RETURN#${id}`,
        sk: "META",
        entityType: "PURCHASE_RETURN",
        purchaseReturnCode,
        supplierId: b.supplierId,
        supplierName: b.supplierName,
        date: b.date || now(),
        status: b.status || "Return",
        referenceNo: b.referenceNo,
        subtotal,
        otherCharges,
        discountOnAll,
        roundOff,
        total,
        note: b.note,
        paymentStatus: b.paymentStatus || "Unpaid",
        lines,
        createdAt: now(),
        updatedAt: now(),
    };
    await putItem(rec);
    res.status(201).json({ id, ...rec });
});
purchasesRouter.patch("/returns/:id", async (req, res) => {
    const id = req.params.id;
    const b = req.body;
    const updates = { updatedAt: now() };
    const allowed = ["supplierId", "supplierName", "date", "status", "referenceNo", "subtotal", "otherCharges", "discountOnAll", "roundOff", "total", "note", "paymentStatus", "lines"];
    for (const k of allowed) {
        if (b[k] !== undefined)
            updates[k] = b[k];
    }
    await updateItem(`PURCHASE_RETURN#${id}`, "META", updates);
    res.json({ ok: true });
});
purchasesRouter.delete("/returns/:id", async (req, res) => {
    await deleteItem(`PURCHASE_RETURN#${req.params.id}`, "META");
    res.json({ ok: true });
});
