import { Router } from "express";
import { v4 as uuid } from "uuid";
import { deleteItem, getItem, putItem, scanByEntityPrefix, updateItem } from "../db/repo.js";
import { authMiddleware } from "../middleware/auth.js";
const now = () => new Date().toISOString();
export const customersRouter = Router();
customersRouter.use(authMiddleware);
customersRouter.get("/", async (_req, res) => {
    const rows = await scanByEntityPrefix("CUSTOMER#");
    res.json({ customers: rows });
});
customersRouter.post("/", async (req, res) => {
    const { name, phone, email, address } = req.body;
    if (!name) {
        res.status(400).json({ error: "name required" });
        return;
    }
    const id = uuid();
    const rec = {
        pk: `CUSTOMER#${id}`,
        sk: "PROFILE",
        entityType: "CUSTOMER",
        name,
        phone,
        email,
        address,
        createdAt: now(),
        updatedAt: now(),
    };
    await putItem(rec);
    res.status(201).json({ id, ...rec });
});
customersRouter.post("/import", async (req, res) => {
    const { rows } = req.body;
    if (!Array.isArray(rows)) {
        res.status(400).json({ error: "rows array required" });
        return;
    }
    const created = [];
    for (const r of rows) {
        if (!r?.name)
            continue;
        const id = uuid();
        const rec = {
            pk: `CUSTOMER#${id}`,
            sk: "PROFILE",
            entityType: "CUSTOMER",
            name: String(r.name),
            phone: r.phone,
            email: r.email,
            address: r.address,
            createdAt: now(),
            updatedAt: now(),
        };
        await putItem(rec);
        created.push(id);
    }
    res.json({ imported: created.length, ids: created });
});
customersRouter.get("/:id", async (req, res) => {
    const row = await getItem(`CUSTOMER#${req.params.id}`, "PROFILE");
    if (!row) {
        res.status(404).json({ error: "Not found" });
        return;
    }
    res.json(row);
});
customersRouter.patch("/:id", async (req, res) => {
    const pk = `CUSTOMER#${req.params.id}`;
    const existing = await getItem(pk, "PROFILE");
    if (!existing) {
        res.status(404).json({ error: "Not found" });
        return;
    }
    const { name, phone, email, address } = req.body;
    await updateItem(pk, "PROFILE", {
        ...(name != null ? { name } : {}),
        ...(phone != null ? { phone } : {}),
        ...(email != null ? { email } : {}),
        ...(address != null ? { address } : {}),
        updatedAt: now(),
    });
    res.json({ ok: true });
});
customersRouter.delete("/:id", async (req, res) => {
    await deleteItem(`CUSTOMER#${req.params.id}`, "PROFILE");
    res.json({ ok: true });
});
