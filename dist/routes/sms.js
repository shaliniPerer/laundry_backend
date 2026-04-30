import { Router } from "express";
import { v4 as uuid } from "uuid";
import { putItem, scanByEntityPrefix } from "../db/repo.js";
import { authMiddleware } from "../middleware/auth.js";
const now = () => new Date().toISOString();
export const smsRouter = Router();
smsRouter.use(authMiddleware);
smsRouter.get("/", async (_req, res) => {
    const rows = await scanByEntityPrefix("SMS#");
    res.json({ messages: rows });
});
smsRouter.post("/", async (req, res) => {
    const { phone, message } = req.body;
    if (!phone || !message) {
        res.status(400).json({ error: "phone and message required" });
        return;
    }
    const id = uuid();
    const rec = {
        pk: `SMS#${id}`,
        sk: "META",
        entityType: "SMS",
        phone,
        message,
        status: "queued",
        createdAt: now(),
        updatedAt: now(),
    };
    await putItem(rec);
    res.status(201).json({
        id,
        ...rec,
        note: "Connect AWS SNS or a provider in production to send SMS.",
    });
});
