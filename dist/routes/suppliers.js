import { Router } from "express";
import { v4 as uuid } from "uuid";
import { deleteItem, putItem, scanByEntityPrefix, updateItem } from "../db/repo.js";
import { authMiddleware } from "../middleware/auth.js";
const now = () => new Date().toISOString();
export const suppliersRouter = Router();
suppliersRouter.use(authMiddleware);
suppliersRouter.get("/", async (_req, res) => {
    const rows = await scanByEntityPrefix("SUPPLIER#");
    res.json({ suppliers: rows });
});
suppliersRouter.post("/", async (req, res) => {
    const b = req.body;
    if (!b.name) {
        res.status(400).json({ error: "name required" });
        return;
    }
    const existing = await scanByEntityPrefix("SUPPLIER#");
    const count = existing.filter((r) => r.entityType === "SUPPLIER").length + 1;
    const supplierNumber = `SU${String(count).padStart(4, "0")}`;
    const id = uuid();
    const rec = {
        pk: `SUPPLIER#${id}`,
        sk: "PROFILE",
        entityType: "SUPPLIER",
        supplierNumber,
        name: b.name,
        mobile: b.mobile,
        phone: b.phone,
        email: b.email,
        gstNumber: b.gstNumber,
        taxNumber: b.taxNumber,
        country: b.country,
        state: b.state,
        city: b.city,
        postcode: b.postcode,
        address: b.address,
        previousDue: b.previousDue != null ? Number(b.previousDue) : undefined,
        status: b.status || "active",
        createdAt: now(),
        updatedAt: now(),
    };
    await putItem(rec);
    res.status(201).json({ id, ...rec });
});
suppliersRouter.patch("/:id", async (req, res) => {
    const id = req.params.id;
    const b = req.body;
    const updates = { updatedAt: now() };
    const allowed = ["name", "mobile", "phone", "email", "gstNumber", "taxNumber", "country", "state", "city", "postcode", "address", "previousDue", "status"];
    for (const k of allowed) {
        if (b[k] !== undefined)
            updates[k] = b[k];
    }
    await updateItem(`SUPPLIER#${id}`, "PROFILE", updates);
    res.json({ ok: true });
});
suppliersRouter.delete("/:id", async (req, res) => {
    await deleteItem(`SUPPLIER#${req.params.id}`, "PROFILE");
    res.json({ ok: true });
});
suppliersRouter.post("/import", async (req, res) => {
    const { rows } = req.body;
    if (!Array.isArray(rows)) {
        res.status(400).json({ error: "rows required" });
        return;
    }
    const existing = await scanByEntityPrefix("SUPPLIER#");
    let count = existing.filter((r) => r.entityType === "SUPPLIER").length;
    let imported = 0;
    for (const b of rows) {
        if (!b.name)
            continue;
        count++;
        const id = uuid();
        const rec = {
            pk: `SUPPLIER#${id}`,
            sk: "PROFILE",
            entityType: "SUPPLIER",
            supplierNumber: `SU${String(count).padStart(4, "0")}`,
            name: b.name,
            mobile: b.mobile,
            email: b.email,
            phone: b.phone,
            gstNumber: b.gstNumber,
            taxNumber: b.taxNumber,
            country: b.country,
            state: b.state,
            city: b.city,
            postcode: b.postcode,
            address: b.address,
            previousDue: b.previousDue != null ? Number(b.previousDue) : undefined,
            status: "active",
            createdAt: now(),
            updatedAt: now(),
        };
        await putItem(rec);
        imported++;
    }
    res.json({ imported });
});
