import { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { v4 as uuid } from "uuid";
import { deleteItem, getItem, putItem, scanByEntityPrefix, updateItem } from "../db/repo.js";
import { authMiddleware } from "../middleware/auth.js";
const now = () => new Date().toISOString();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const expenseUploadsDir = path.resolve(__dirname, "../../public/expenses");
function sanitizeFileName(name) {
    return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "attachment";
}
async function saveExpenseAttachment(expenseId, attachment) {
    if (!attachment?.dataUrl || !attachment.fileName || !attachment.mimeType)
        return undefined;
    const match = attachment.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match)
        return undefined;
    const buffer = Buffer.from(match[2], "base64");
    await fs.mkdir(expenseUploadsDir, { recursive: true });
    const safeName = sanitizeFileName(attachment.fileName);
    const savedName = `${expenseId}-${safeName}`;
    await fs.writeFile(path.join(expenseUploadsDir, savedName), buffer);
    return {
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        size: buffer.length,
        url: `/public/expenses/${savedName}`,
    };
}
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
    const { name, description, status } = req.body;
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
        description,
        status: status || "active",
        createdAt: now(),
        updatedAt: now(),
    };
    await putItem(rec);
    res.status(201).json({ id, ...rec });
});
expensesRouter.patch("/categories/:id", async (req, res) => {
    const pk = `EXPENSE_CAT#${req.params.id}`;
    const existing = await getItem(pk, "PROFILE");
    if (!existing) {
        res.status(404).json({ error: "Not found" });
        return;
    }
    const { name, description, status } = req.body;
    await updateItem(pk, "PROFILE", {
        ...(name != null ? { name } : {}),
        ...(description != null ? { description } : {}),
        ...(status != null ? { status } : {}),
        updatedAt: now(),
    });
    res.json({ ok: true });
});
expensesRouter.delete("/categories/:id", async (req, res) => {
    await deleteItem(`EXPENSE_CAT#${req.params.id}`, "PROFILE");
    res.json({ ok: true });
});
expensesRouter.post("/", async (req, res) => {
    const b = req.body;
    if (b.amount == null || !b.date || !b.expenseFor) {
        res.status(400).json({ error: "amount, date and expenseFor required" });
        return;
    }
    const id = uuid();
    const attachment = await saveExpenseAttachment(id, b.attachment);
    const rec = {
        pk: `EXPENSE#${id}`,
        sk: "META",
        entityType: "EXPENSE",
        categoryId: b.categoryId,
        categoryName: b.categoryName,
        amount: Number(b.amount),
        date: b.date,
        note: b.note,
        expenseFor: b.expenseFor,
        referenceNo: b.referenceNo,
        createdBy: b.createdBy,
        attachment,
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
        ...(b.categoryName != null ? { categoryName: b.categoryName } : {}),
        ...(b.amount != null ? { amount: Number(b.amount) } : {}),
        ...(b.date != null ? { date: b.date } : {}),
        ...(b.note != null ? { note: b.note } : {}),
        ...(b.expenseFor != null ? { expenseFor: b.expenseFor } : {}),
        ...(b.referenceNo != null ? { referenceNo: b.referenceNo } : {}),
        updatedAt: now(),
    });
    res.json({ ok: true });
});
expensesRouter.delete("/:id", async (req, res) => {
    await deleteItem(`EXPENSE#${req.params.id}`, "META");
    res.json({ ok: true });
});
