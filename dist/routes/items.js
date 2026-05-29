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
    if (!body.name) {
        res.status(400).json({ error: "name required" });
        return;
    }
    const existing = await scanByEntityPrefix("ITEM#");
    const count = existing.filter((r) => r.entityType === "ITEM").length + 1;
    const itemNumber = `IT${String(count).padStart(4, "0")}`;
    const id = uuid();
    const rec = {
        pk: `ITEM#${id}`,
        sk: "PROFILE",
        entityType: "ITEM",
        itemNumber,
        name: body.name,
        sku: body.sku,
        hsn: body.hsn,
        categoryId: body.categoryId,
        brandId: body.brandId,
        price: Number(body.price ?? 0),
        purchasePrice: body.purchasePrice != null ? Number(body.purchasePrice) : undefined,
        salesPrice: body.salesPrice != null ? Number(body.salesPrice) : undefined,
        finalPrice: body.finalPrice != null ? Number(body.finalPrice) : undefined,
        profitMargin: body.profitMargin != null ? Number(body.profitMargin) : undefined,
        discountType: body.discountType,
        discount: body.discount != null ? Number(body.discount) : undefined,
        unit: body.unit,
        minimumQty: body.minimumQty != null ? Number(body.minimumQty) : undefined,
        openingStock: body.openingStock != null ? Number(body.openingStock) : 0,
        expireDate: body.expireDate,
        barcode: body.barcode,
        description: body.description,
        taxName: body.taxName,
        taxValue: body.taxValue != null ? Number(body.taxValue) : undefined,
        taxType: body.taxType,
        status: body.status || "active",
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
    const { name, kind, description } = req.body;
    if (!name || !kind) {
        res.status(400).json({ error: "name and kind required" });
        return;
    }
    const existing = await scanByEntityPrefix("CATEGORY#");
    const count = existing.filter((r) => r.entityType === "CATEGORY").length + 1;
    const categoryCode = `CT${String(count).padStart(4, "0")}`;
    const id = uuid();
    const rec = {
        pk: `CATEGORY#${id}`,
        sk: `TYPE#${kind}`,
        entityType: "CATEGORY",
        categoryCode,
        name,
        kind,
        description,
        status: "active",
        createdAt: now(),
        updatedAt: now(),
    };
    await putItem(rec);
    res.status(201).json({ id, ...rec });
});
itemsRouter.patch("/categories/:id", async (req, res) => {
    const allCats = await scanByEntityPrefix("CATEGORY#");
    const row = allCats.find((r) => r.pk === `CATEGORY#${req.params.id}`);
    if (!row) {
        res.status(404).json({ error: "Not found" });
        return;
    }
    const b = req.body;
    await updateItem(row.pk, row.sk, {
        ...(b.name != null ? { name: b.name } : {}),
        ...(b.description != null ? { description: b.description } : {}),
        ...(b.status != null ? { status: b.status } : {}),
        updatedAt: now(),
    });
    res.json({ ok: true });
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
    const { name, description } = req.body;
    if (!name) {
        res.status(400).json({ error: "name required" });
        return;
    }
    const existing = await scanByEntityPrefix("BRAND#");
    const count = existing.filter((r) => r.entityType === "BRAND").length + 1;
    const brandCode = `BR${String(count).padStart(4, "0")}`;
    const id = uuid();
    const rec = {
        pk: `BRAND#${id}`,
        sk: "PROFILE",
        entityType: "BRAND",
        brandCode,
        name,
        description,
        status: "active",
        createdAt: now(),
        updatedAt: now(),
    };
    await putItem(rec);
    res.status(201).json({ id, ...rec });
});
itemsRouter.patch("/brands/:id", async (req, res) => {
    const pk = `BRAND#${req.params.id}`;
    const existing = await getItem(pk, "PROFILE");
    if (!existing) {
        res.status(404).json({ error: "Not found" });
        return;
    }
    const b = req.body;
    await updateItem(pk, "PROFILE", {
        ...(b.name != null ? { name: b.name } : {}),
        ...(b.description != null ? { description: b.description } : {}),
        ...(b.status != null ? { status: b.status } : {}),
        updatedAt: now(),
    });
    res.json({ ok: true });
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
        ...(b.hsn != null ? { hsn: b.hsn } : {}),
        ...(b.categoryId != null ? { categoryId: b.categoryId } : {}),
        ...(b.brandId != null ? { brandId: b.brandId } : {}),
        ...(b.price != null ? { price: Number(b.price) } : {}),
        ...(b.purchasePrice != null ? { purchasePrice: Number(b.purchasePrice) } : {}),
        ...(b.salesPrice != null ? { salesPrice: Number(b.salesPrice) } : {}),
        ...(b.finalPrice != null ? { finalPrice: Number(b.finalPrice) } : {}),
        ...(b.profitMargin != null ? { profitMargin: Number(b.profitMargin) } : {}),
        ...(b.discountType != null ? { discountType: b.discountType } : {}),
        ...(b.discount != null ? { discount: Number(b.discount) } : {}),
        ...(b.unit != null ? { unit: b.unit } : {}),
        ...(b.minimumQty != null ? { minimumQty: Number(b.minimumQty) } : {}),
        ...(b.openingStock != null ? { openingStock: Number(b.openingStock) } : {}),
        ...(b.expireDate != null ? { expireDate: b.expireDate } : {}),
        ...(b.barcode != null ? { barcode: b.barcode } : {}),
        ...(b.description != null ? { description: b.description } : {}),
        ...(b.taxName != null ? { taxName: b.taxName } : {}),
        ...(b.taxValue != null ? { taxValue: Number(b.taxValue) } : {}),
        ...(b.taxType != null ? { taxType: b.taxType } : {}),
        ...(b.status != null ? { status: b.status } : {}),
        updatedAt: now(),
    });
    res.json({ ok: true });
});
itemsRouter.delete("/:id", async (req, res) => {
    await deleteItem(`ITEM#${req.params.id}`, "PROFILE");
    res.json({ ok: true });
});
