import { Router } from "express";
import { scanByEntityPrefix } from "../db/repo.js";
import { authMiddleware } from "../middleware/auth.js";
export const reportsRouter = Router();
reportsRouter.use(authMiddleware);
reportsRouter.get("/profit-loss", async (req, res) => {
    const from = String(req.query.from || "");
    const to = String(req.query.to || "");
    if (!from || !to) {
        res.status(400).json({ error: "from and to query params required (YYYY-MM-DD)" });
        return;
    }
    const salesRows = (await scanByEntityPrefix("SALE#"));
    const sales = salesRows.filter((s) => s.entityType === "SALE" && s.deliveryDate >= from && s.deliveryDate <= to);
    const retRows = (await scanByEntityPrefix("SALE_RETURN#"));
    const returns = retRows.filter((r) => r.createdAt >= from && r.createdAt <= to + "T23:59:59.999Z");
    const expRows = (await scanByEntityPrefix("EXPENSE#"));
    const expenses = expRows.filter((e) => e.entityType === "EXPENSE" && e.date >= from && e.date <= to);
    const revenue = sales.reduce((s, x) => s + Number(x.total ?? 0), 0);
    const returnsTotal = returns.reduce((s, x) => s + Number(x.total ?? 0), 0);
    const expenseTotal = expenses.reduce((s, x) => s + Number(x.amount ?? 0), 0);
    const net = revenue - returnsTotal - expenseTotal;
    res.json({
        period: { from, to },
        revenue,
        salesCount: sales.length,
        returnsTotal,
        returnsCount: returns.length,
        expenseTotal,
        expensesCount: expenses.length,
        net,
    });
});
reportsRouter.get("/summary", async (req, res) => {
    const from = String(req.query.from || "");
    const to = String(req.query.to || "");
    if (!from || !to) {
        res.status(400).json({ error: "from and to required" });
        return;
    }
    const salesRows = (await scanByEntityPrefix("SALE#"));
    const sales = salesRows.filter((s) => s.entityType === "SALE" && s.deliveryDate >= from && s.deliveryDate <= to);
    res.json({
        title: "Sales summary",
        period: { from, to },
        rows: sales.map((s) => ({
            saleNumber: s.saleNumber,
            deliveryDate: s.deliveryDate,
            total: s.total,
            status: s.status,
        })),
    });
});
