import { Router } from "express";
import { v4 as uuid } from "uuid";
import { deleteItem, getItem, putItem, scanByEntityPrefix, updateItem } from "../db/repo.js";
import { authMiddleware } from "../middleware/auth.js";
const now = () => new Date().toISOString();
export const itemsRouter = Router();
itemsRouter.use(authMiddleware);
itemsRouter.get("/", async (_req, res) => {
    const rows = await scanByEntityPrefix("ITEM#");
    res.json({ items: rows });
});
itemsRouter.post("/", async (req, res) => {
    const body = req.body;
    if (!body.name || body.price == null) {
        res.status(400).json({ error: "name and price required" });
        return;
    }
    const id = uuid();
    const rec = {
        pk: `ITEM#${id}`,
        sk: "PROFILE",
        entityType: "ITEM",
        name: body.name,
        sku: body.sku,
        categoryId: body.categoryId,
        brandId: body.brandId,
        price: Number(body.price),
        unit: body.unit,
        createdAt: now(),
        updatedAt: now(),
    };
    await putItem(rec);
    res.status(201).json({ id, ...rec });
});
itemsRouter.post("/import", async (req, res) => {
    const { rows } = req.body;
    if (!Array.isArray(rows)) {
        res.status(400).json({ error: "rows array required" });
        return;
    }
    const ids = [];
    for (const r of rows) {
        if (!r?.name || r.price == null)
            continue;
        const id = uuid();
        await putItem({
            pk: `ITEM#${id}`,
            sk: "PROFILE",
            entityType: "ITEM",
            name: String(r.name),
            sku: r.sku,
            categoryId: r.categoryId,
            brandId: r.brandId,
            price: Number(r.price),
            unit: r.unit,
            createdAt: now(),
            updatedAt: now(),
        });
        ids.push(id);
    }
    res.json({ imported: ids.length, ids });
});
itemsRouter.get("/categories", async (req, res) => {
    const kind = req.query.kind || "item";
    const rows = (await scanByEntityPrefix("CATEGORY#"));
    res.json({ categories: rows.filter((c) => !kind || c.kind === kind) });
});
itemsRouter.post("/categories", async (req, res) => {
    const { name, kind } = req.body;
    if (!name || !kind) {
        res.status(400).json({ error: "name and kind required" });
        return;
    }
    const id = uuid();
    const rec = {
        pk: `CATEGORY#${id}`,
        sk: `TYPE#${kind}`,
        entityType: "CATEGORY",
        name,
        kind,
        createdAt: now(),
        updatedAt: now(),
    };
    await putItem(rec);
    res.status(201).json({ id, ...rec });
});
itemsRouter.delete("/categories/:id", async (req, res) => {
    const rows = await scanByEntityPrefix("CATEGORY#");
    const row = rows.find((r) => r.pk === `CATEGORY#${req.params.id}`);
    if (!row) {
        res.status(404).json({ error: "Not found" });
        return;
    }
    await deleteItem(row.pk, row.sk);
    res.json({ ok: true });
});
itemsRouter.get("/brands", async (_req, res) => {
    const rows = await scanByEntityPrefix("BRAND#");
    res.json({ brands: rows });
});
itemsRouter.post("/brands", async (req, res) => {
    const { name } = req.body;
    if (!name) {
        res.status(400).json({ error: "name required" });
        return;
    }
    const id = uuid();
    const rec = {
        pk: `BRAND#${id}`,
        sk: "PROFILE",
        entityType: "BRAND",
        name,
        createdAt: now(),
        updatedAt: now(),
    };
    await putItem(rec);
    res.status(201).json({ id, ...rec });
});
itemsRouter.delete("/brands/:id", async (req, res) => {
    await deleteItem(`BRAND#${req.params.id}`, "PROFILE");
    res.json({ ok: true });
});
itemsRouter.get("/:id", async (req, res) => {
    const row = await getItem(`ITEM#${req.params.id}`, "PROFILE");
    if (!row) {
        res.status(404).json({ error: "Not found" });
        return;
    }
    res.json(row);
});
itemsRouter.patch("/:id", async (req, res) => {
    const pk = `ITEM#${req.params.id}`;
    const existing = await getItem(pk, "PROFILE");
    if (!existing) {
        res.status(404).json({ error: "Not found" });
        return;
    }
    const b = req.body;
    await updateItem(pk, "PROFILE", {
        ...(b.name != null ? { name: b.name } : {}),
        ...(b.sku != null ? { sku: b.sku } : {}),
        ...(b.categoryId != null ? { categoryId: b.categoryId } : {}),
        ...(b.brandId != null ? { brandId: b.brandId } : {}),
        ...(b.price != null ? { price: Number(b.price) } : {}),
        ...(b.unit != null ? { unit: b.unit } : {}),
        updatedAt: now(),
    });
    res.json({ ok: true });
});
itemsRouter.delete("/:id", async (req, res) => {
    await deleteItem(`ITEM#${req.params.id}`, "PROFILE");
    res.json({ ok: true });
});
