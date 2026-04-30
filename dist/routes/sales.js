import { Router } from "express";
import { v4 as uuid } from "uuid";
import { deleteItem, getItem, putItem, scanByEntityPrefix } from "../db/repo.js";
import { authMiddleware } from "../middleware/auth.js";
const now = () => new Date().toISOString();
export const salesRouter = Router();
salesRouter.use(authMiddleware);
function saleNumber() {
    return `S-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}
salesRouter.get("/", async (_req, res) => {
    const rows = await scanByEntityPrefix("SALE#");
    const sales = rows.filter((r) => r.entityType === "SALE");
    res.json({ sales });
});
salesRouter.post("/pos", async (req, res) => {
    const body = req.body;
    if (!body.deliveryDate || !Array.isArray(body.lines)) {
        res.status(400).json({ error: "deliveryDate and lines required" });
        return;
    }
    const total = body.lines.reduce((s, l) => s + Number(l.lineTotal ?? 0), 0);
    const id = uuid();
    const rec = {
        pk: `SALE#${id}`,
        sk: "META",
        entityType: "SALE",
        saleNumber: saleNumber(),
        customerId: body.customerId,
        deliveryDate: body.deliveryDate,
        total,
        status: "pending",
        lines: body.lines,
        createdAt: now(),
        updatedAt: now(),
    };
    await putItem(rec);
    res.status(201).json({ id, ...rec });
});
salesRouter.get("/returns/list", async (_req, res) => {
    const rows = await scanByEntityPrefix("SALE_RETURN#");
    res.json({ returns: rows });
});
salesRouter.post("/returns", async (req, res) => {
    const body = req.body;
    if (body.total == null) {
        res.status(400).json({ error: "total required" });
        return;
    }
    const id = uuid();
    const rec = {
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
    if (!row || row.entityType !== "SALE") {
        res.status(404).json({ error: "Not found" });
        return;
    }
    res.json(row);
});
salesRouter.delete("/:id", async (req, res) => {
    await deleteItem(`SALE#${req.params.id}`, "META");
    res.json({ ok: true });
});
