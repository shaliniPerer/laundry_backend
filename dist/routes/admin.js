import { Router } from "express";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import { deleteItem, getItem, putItem, scanByEntityPrefix, updateItem } from "../db/repo.js";
import { authMiddleware } from "../middleware/auth.js";
const now = () => new Date().toISOString();
export const adminRouter = Router();
adminRouter.use(authMiddleware);
adminRouter.get("/users", async (_req, res) => {
    const rows = (await scanByEntityPrefix("USER#"));
    const users = rows.map((u) => ({
        id: u.pk.replace("USER#", ""),
        email: u.email,
        name: u.name,
        roleId: u.roleId,
        createdAt: u.createdAt,
    }));
    res.json({ users });
});
adminRouter.post("/users", async (req, res) => {
    const { email, password, name, roleId } = req.body;
    if (!email || !password || !name) {
        res.status(400).json({ error: "email, password, name required" });
        return;
    }
    const existing = await scanByEntityPrefix("USER#");
    if (existing.some((u) => u.email?.toLowerCase() === email.toLowerCase())) {
        res.status(409).json({ error: "Email already exists" });
        return;
    }
    const id = uuid();
    const passwordHash = await bcrypt.hash(password, 10);
    const rec = {
        pk: `USER#${id}`,
        sk: "PROFILE",
        entityType: "USER",
        email: email.toLowerCase(),
        passwordHash,
        name,
        roleId,
        createdAt: now(),
        updatedAt: now(),
    };
    await putItem(rec);
    res.status(201).json({ id, email: rec.email, name: rec.name, roleId: rec.roleId });
});
adminRouter.patch("/users/:id", async (req, res) => {
    const pk = `USER#${req.params.id}`;
    const existing = await getItem(pk, "PROFILE");
    if (!existing) {
        res.status(404).json({ error: "Not found" });
        return;
    }
    const { name, roleId, password } = req.body;
    const updates = { updatedAt: now() };
    if (name != null)
        updates.name = name;
    if (roleId != null)
        updates.roleId = roleId;
    if (password)
        updates.passwordHash = await bcrypt.hash(password, 10);
    await updateItem(pk, "PROFILE", updates);
    res.json({ ok: true });
});
adminRouter.delete("/users/:id", async (req, res) => {
    await deleteItem(`USER#${req.params.id}`, "PROFILE");
    res.json({ ok: true });
});
adminRouter.get("/roles", async (_req, res) => {
    const rows = await scanByEntityPrefix("ROLE#");
    res.json({ roles: rows });
});
adminRouter.post("/roles", async (req, res) => {
    const { name, permissions } = req.body;
    if (!name) {
        res.status(400).json({ error: "name required" });
        return;
    }
    const id = uuid();
    const rec = {
        pk: `ROLE#${id}`,
        sk: "PROFILE",
        entityType: "ROLE",
        name,
        permissions: permissions ?? [],
        createdAt: now(),
        updatedAt: now(),
    };
    await putItem(rec);
    res.status(201).json({ id, ...rec });
});
adminRouter.delete("/roles/:id", async (req, res) => {
    await deleteItem(`ROLE#${req.params.id}`, "PROFILE");
    res.json({ ok: true });
});
