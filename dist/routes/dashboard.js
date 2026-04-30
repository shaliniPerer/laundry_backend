import { Router } from "express";
import { scanSalesByDeliveryRange } from "../db/repo.js";
import { authMiddleware } from "../middleware/auth.js";
export const dashboardRouter = Router();
dashboardRouter.use(authMiddleware);
dashboardRouter.get("/deliveries", async (req, res) => {
    const start = String(req.query.start || "");
    const end = String(req.query.end || "");
    if (!start || !end) {
        res.status(400).json({ error: "start and end query params required (YYYY-MM-DD)" });
        return;
    }
    const items = await scanSalesByDeliveryRange(start, end);
    res.json({ sales: items });
});
