import { Router } from "express";
import { v4 as uuid } from "uuid";
import { deleteItem, getItem, putItem, scanByEntityPrefix, updateItem } from "../db/repo.js";
import { authMiddleware } from "../middleware/auth.js";
const now = () => new Date().toISOString();
export const expensesRouter = Router();
expensesRouter.use(authMiddleware);
expensesRouter.get("/", async (_req, res) => {
    const rows = await scanByEntityPrefix("EXPENSE#");
    const list = rows.filter((r) => r.entityType === "EXPENSE");
    res.json({ expenses: list });
});
expensesRouter.get("/categories/list", async (_req, res) => {
    const rows = (await scanByEntityPrefix("EXPENSE_CAT#"));
    res.json({ categories: rows });
});
expensesRouter.post("/categories", async (req, res) => {
    const { name } = req.body;
    if (!name) {
        res.status(400).json({ error: "name required" });
        return;
    }
    const id = uuid();
    const rec = {
        pk: `EXPENSE_CAT#${id}`,
        sk: "PROFILE",
        entityType: "EXPENSE_CATEGORY",
        name,
        createdAt: now(),
        updatedAt: now(),
    };
    await putItem(rec);
    res.status(201).json({ id, ...rec });
});
expensesRouter.delete("/categories/:id", async (req, res) => {
    await deleteItem(`EXPENSE_CAT#${req.params.id}`, "PROFILE");
    res.json({ ok: true });
});
expensesRouter.post("/", async (req, res) => {
    const b = req.body;
    if (b.amount == null || !b.date) {
        res.status(400).json({ error: "amount and date required" });
        return;
    }
    const id = uuid();
    const rec = {
        pk: `EXPENSE#${id}`,
        sk: "META",
        entityType: "EXPENSE",
        categoryId: b.categoryId,
        amount: Number(b.amount),
        date: b.date,
        note: b.note,
        createdAt: now(),
        updatedAt: now(),
    };
    await putItem(rec);
    res.status(201).json({ id, ...rec });
});
expensesRouter.patch("/:id", async (req, res) => {
    const pk = `EXPENSE#${req.params.id}`;
    const existing = await getItem(pk, "META");
    if (!existing) {
        res.status(404).json({ error: "Not found" });
        return;
    }
    const b = req.body;
    await updateItem(pk, "META", {
        ...(b.categoryId != null ? { categoryId: b.categoryId } : {}),
        ...(b.amount != null ? { amount: Number(b.amount) } : {}),
        ...(b.date != null ? { date: b.date } : {}),
        ...(b.note != null ? { note: b.note } : {}),
        updatedAt: now(),
    });
    res.json({ ok: true });
});
expensesRouter.delete("/:id", async (req, res) => {
    await deleteItem(`EXPENSE#${req.params.id}`, "META");
    res.json({ ok: true });
});
