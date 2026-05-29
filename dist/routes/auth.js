import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuid } from "uuid";
import { config } from "../config.js";
import { getItem, putItem, scanByEntityPrefix } from "../db/repo.js";
import { authMiddleware } from "../middleware/auth.js";
const now = () => new Date().toISOString();
export const authRouter = Router();
authRouter.post("/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        res.status(400).json({ error: "Email and password required" });
        return;
    }
    const users = await scanByEntityPrefix("USER#");
    const user = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!user || !user.passwordHash) {
        res.status(401).json({ error: "Invalid credentials" });
        return;
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
        res.status(401).json({ error: "Invalid credentials" });
        return;
    }
    const id = user.pk.replace("USER#", "");
    const token = jwt.sign({ sub: id, roleId: user.roleId }, config.jwtSecret, { expiresIn: config.jwtExpires });
    res.json({
        token,
        user: { id, email: user.email, name: user.name, roleId: user.roleId },
    });
});
authRouter.post("/register", async (req, res) => {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
        res.status(400).json({ error: "email, password, name required" });
        return;
    }
    const existing = await scanByEntityPrefix("USER#");
    if (existing.some((u) => u.email?.toLowerCase() === email.toLowerCase())) {
        res.status(409).json({ error: "Email already registered" });
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
        createdAt: now(),
        updatedAt: now(),
    };
    await putItem(rec);
    const token = jwt.sign({ sub: id }, config.jwtSecret, {
        expiresIn: config.jwtExpires,
    });
    res.status(201).json({
        token,
        user: { id, email: rec.email, name: rec.name },
    });
});
authRouter.get("/me", authMiddleware, async (req, res) => {
    const id = req.userId;
    const u = (await getItem(`USER#${id}`, "PROFILE"));
    if (!u) {
        res.status(404).json({ error: "User not found" });
        return;
    }
    res.json({
        id,
        email: u.email,
        name: u.name,
        roleId: u.roleId,
    });
});
/**
 * PATCH /api/auth/me  — update name (and optionally email)
 */
authRouter.patch("/me", authMiddleware, async (req, res) => {
    const id = req.userId;
    const { name, email } = req.body;
    if (!name && !email) {
        res.status(400).json({ error: "name or email required" });
        return;
    }
    const u = (await getItem(`USER#${id}`, "PROFILE"));
    if (!u) {
        res.status(404).json({ error: "Not found" });
        return;
    }
    const updates = { updatedAt: now() };
    if (name)
        updates.name = name;
    if (email)
        updates.email = email.toLowerCase();
    const { updateItem } = await import("../db/repo.js");
    await updateItem(`USER#${id}`, "PROFILE", updates);
    res.json({ ok: true, name: updates.name ?? u.name, email: updates.email ?? u.email });
});
/**
 * POST /api/auth/change-password  — verify current password then set new one
 */
authRouter.post("/change-password", authMiddleware, async (req, res) => {
    const id = req.userId;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
        res.status(400).json({ error: "currentPassword and newPassword required" });
        return;
    }
    if (newPassword.length < 6) {
        res.status(400).json({ error: "New password must be at least 6 characters" });
        return;
    }
    const u = (await getItem(`USER#${id}`, "PROFILE"));
    if (!u) {
        res.status(404).json({ error: "Not found" });
        return;
    }
    const ok = await bcrypt.compare(currentPassword, u.passwordHash);
    if (!ok) {
        res.status(401).json({ error: "Current password is incorrect" });
        return;
    }
    const { updateItem } = await import("../db/repo.js");
    await updateItem(`USER#${id}`, "PROFILE", {
        passwordHash: await bcrypt.hash(newPassword, 10),
        updatedAt: now(),
    });
    res.json({ ok: true });
});
/**
 * POST /api/auth/forgot-password  — reset password by email (admin lookup, no email service)
 * For a local system: finds user by email and resets to supplied newPassword if provided,
 * or returns a one-time token. Here we simply accept email + newPassword.
 */
authRouter.post("/forgot-password", async (req, res) => {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
        res.status(400).json({ error: "email and newPassword required" });
        return;
    }
    if (newPassword.length < 6) {
        res.status(400).json({ error: "Password must be at least 6 characters" });
        return;
    }
    const users = await scanByEntityPrefix("USER#");
    const user = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!user) {
        res.status(404).json({ error: "No account found with that email" });
        return;
    }
    const { updateItem } = await import("../db/repo.js");
    await updateItem(user.pk, "PROFILE", {
        passwordHash: await bcrypt.hash(newPassword, 10),
        updatedAt: now(),
    });
    res.json({ ok: true });
});
