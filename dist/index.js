import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { authRouter } from "./routes/auth.js";
import { customersRouter } from "./routes/customers.js";
import { itemsRouter } from "./routes/items.js";
import { salesRouter } from "./routes/sales.js";
import { expensesRouter } from "./routes/expenses.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { reportsRouter } from "./routes/reports.js";
import { adminRouter } from "./routes/admin.js";
import { smsRouter } from "./routes/sms.js";
const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "laundry-api" });
});
app.use("/api/auth", authRouter);
app.use("/api/customers", customersRouter);
app.use("/api/items", itemsRouter);
app.use("/api/sales", salesRouter);
app.use("/api/expenses", expensesRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/sms", smsRouter);
app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
});
app.listen(config.port, () => {
    console.log(`Laundry API listening on http://localhost:${config.port}`);
});
