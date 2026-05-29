import { Router } from "express";
import { scanSalesByDeliveryRange, scanByEntityPrefix } from "../db/repo.js";
import { authMiddleware } from "../middleware/auth.js";
import type { SaleRecord, CustomerRecord, ExpenseRecord } from "../types.js";

export const dashboardRouter = Router();
dashboardRouter.use(authMiddleware);

function inDateRange(dateValue: string | undefined, start?: string, end?: string) {
  if (!dateValue) return false;
  if (start && dateValue < start) return false;
  if (end && dateValue > end) return false;
  return true;
}

dashboardRouter.get("/deliveries", async (req, res) => {
  const start = String(req.query.start || "");
  const end = String(req.query.end || "");
  if (!start || !end) {
    res.status(400).json({ error: "start and end query params required (YYYY-MM-DD)" });
    return;
  }
  const statusFilter = req.query.statuses
    ? String(req.query.statuses).split(",").map((s) => s.trim().toLowerCase())
    : null;
  const [saleItems, customerItems] = await Promise.all([
    scanSalesByDeliveryRange(start, end),
    scanByEntityPrefix("CUSTOMER#"),
  ]);
  const customerMap: Record<string, string> = {};
  for (const c of customerItems) {
    const customer = c as CustomerRecord;
    if (customer.entityType === "CUSTOMER") {
      const id = customer.pk.replace("CUSTOMER#", "");
      customerMap[id] = customer.name;
    }
  }
  const sales = saleItems
    .filter((s) => {
      if (!statusFilter) return true;
      const st = ((s as SaleRecord).status || "").toLowerCase().replace(/[\s-]+/g, "_");
      return statusFilter.includes(st);
    })
    .map((s) => {
      const sale = s as SaleRecord;
      const customerId = sale.customerId || "";
      return {
        ...sale,
        customerName: customerId
          ? (customerMap[customerId] || sale.customerName || "Walk In Customer")
          : (sale.customerName || "Walk In Customer"),
      };
    });
  res.json({ sales });
});

dashboardRouter.get("/stats", async (req, res) => {
  const [saleItems, expenseItems, customerItems] = await Promise.all([
    scanByEntityPrefix("SALE#"),
    scanByEntityPrefix("EXPENSE#"),
    scanByEntityPrefix("CUSTOMER#"),
  ]);

  const start = req.query.start ? String(req.query.start) : undefined;
  const end = req.query.end ? String(req.query.end) : undefined;
  const year = Number(req.query.year || new Date().getFullYear());

  const allSales = saleItems.filter(
    (r) => (r as SaleRecord).entityType === "SALE"
  ) as Array<SaleRecord & { paymentStatus?: string }>;

  const allExpenses = expenseItems.filter(
    (r) => (r as ExpenseRecord).entityType === "EXPENSE"
  ) as ExpenseRecord[];

  const sales = allSales.filter((s) => inDateRange((s.createdAt || "").slice(0, 10), start, end));
  const expenses = allExpenses.filter((e) => inDateRange(e.date, start, end));

  // Status counts
  const statusCounts = {
    pending: 0,
    processing: 0,
    ready_to_deliver: 0,
    delivered: 0,
    returned: 0,
  };
  for (const s of sales) {
    const st = (s.status || "").toLowerCase().replace(/[\s-]+/g, "_");
    if (st === "pending") statusCounts.pending++;
    else if (st === "processing") statusCounts.processing++;
    else if (st === "ready_to_deliver" || st === "ready to deliver") statusCounts.ready_to_deliver++;
    else if (st === "delivered") statusCounts.delivered++;
    else if (st === "returned") statusCounts.returned++;
    else statusCounts.pending++;
  }

  // Payment counts
  const paymentCounts = { not_paid: 0, partially_paid: 0, fully_paid: 0 };
  for (const s of sales) {
    const ps = (s.paymentStatus || "not_paid").toLowerCase().replace(/[\s-]+/g, "_");
    if (ps === "partially_paid") paymentCounts.partially_paid++;
    else if (ps === "fully_paid") paymentCounts.fully_paid++;
    else paymentCounts.not_paid++;
  }

  // Monthly revenue by selected year
  const monthlySalesMap: Record<string, number> = {};
  for (let month = 1; month <= 12; month++) {
    monthlySalesMap[String(month).padStart(2, "0")] = 0;
  }
  for (const s of allSales) {
    const created = (s.createdAt || "").slice(0, 7);
    if (!created) continue;
    const [saleYear, saleMonth] = created.split("-");
    if (Number(saleYear) !== year || !saleMonth) continue;
    monthlySalesMap[saleMonth] = (monthlySalesMap[saleMonth] || 0) + Number(s.total || 0);
  }
  const monthlySales = Object.entries(monthlySalesMap).map(([month, total]) => ({
    month,
    total,
  }));

  // Payment vs expense in selected date range
  const monthlyRevenue: Record<string, number> = {};
  const monthlyExpenses: Record<string, number> = {};
  for (const s of sales) {
    const month = (s.createdAt || "").slice(0, 7);
    if (month) monthlyRevenue[month] = (monthlyRevenue[month] || 0) + Number(s.total || 0);
  }
  for (const e of expenses) {
    const month = (e.date || "").slice(0, 7);
    if (month) monthlyExpenses[month] = (monthlyExpenses[month] || 0) + Number(e.amount || 0);
  }
  const allMonths = [
    ...new Set([...Object.keys(monthlyRevenue), ...Object.keys(monthlyExpenses)]),
  ]
    .sort()
    .slice(-6);
  const monthlyData = allMonths.map((m) => ({
    month: m,
    revenue: monthlyRevenue[m] || 0,
    expenses: monthlyExpenses[m] || 0,
  }));

  res.json({ statusCounts, paymentCounts, monthlyData, monthlySales,
    totalCustomers: customerItems.filter(c => (c as CustomerRecord).entityType === "CUSTOMER").length,
    totalExpensesAmount: allExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0),
  });
});

dashboardRouter.get("/today", async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const [saleItems, customerItems, expenseItems] = await Promise.all([
    scanByEntityPrefix("SALE#"),
    scanByEntityPrefix("CUSTOMER#"),
    scanByEntityPrefix("EXPENSE#"),
  ]);
  const todaySales = (saleItems as SaleRecord[]).filter(
    r => r.entityType === "SALE" && (r.createdAt || "").slice(0, 10) === today
  );
  const todayCustomers = (customerItems as CustomerRecord[]).filter(
    r => r.entityType === "CUSTOMER" && (r.createdAt || "").slice(0, 10) === today
  );
  const todayExpenseItems = (expenseItems as ExpenseRecord[]).filter(
    r => r.entityType === "EXPENSE" && r.date === today
  );
  let todayReceivedAmount = 0;
  for (const sale of saleItems as SaleRecord[]) {
    if (sale.entityType !== "SALE" || !sale.payments) continue;
    for (const p of sale.payments as Array<{ date?: string; amount?: number }>) {
      if ((p.date || "").slice(0, 10) === today) {
        todayReceivedAmount += Number(p.amount || 0);
      }
    }
  }
  res.json({
    todayInvoices: todaySales.length,
    todayNewCustomers: todayCustomers.length,
    todaySalesAmount: todaySales.reduce((sum, s) => sum + Number(s.total || 0), 0),
    todayReceivedAmount,
    todayExpensesAmount: todayExpenseItems.reduce((sum, e) => sum + Number(e.amount || 0), 0),
  });
});
