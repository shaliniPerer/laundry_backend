import { Router } from "express";
import { scanByEntityPrefix } from "../db/repo.js";
import type { ExpenseRecord, ItemRecord, SaleRecord, SaleReturnRecord } from "../types.js";
import { authMiddleware } from "../middleware/auth.js";

export const reportsRouter = Router();
reportsRouter.use(authMiddleware);

reportsRouter.get("/profit-loss", async (req, res) => {
  const from = String(req.query.from || "");
  const to = String(req.query.to || "");

  const [salesRows, retRows, expRows, itemRows] = await Promise.all([
    scanByEntityPrefix("SALE#"),
    scanByEntityPrefix("SALE_RETURN#"),
    scanByEntityPrefix("EXPENSE#"),
    scanByEntityPrefix("ITEM#"),
  ]);

  const sales = (salesRows as SaleRecord[]).filter(
    (s) => s.entityType === "SALE" && (!from || s.deliveryDate >= from) && (!to || s.deliveryDate <= to)
  );
  const returns = (retRows as SaleReturnRecord[]).filter(
    (r) => r.entityType === "SALE_RETURN" && (!from || (r.createdAt?.slice(0, 10) ?? "") >= from) && (!to || (r.createdAt?.slice(0, 10) ?? "") <= to)
  );
  const expenses = (expRows as ExpenseRecord[]).filter(
    (e) => e.entityType === "EXPENSE" && (!from || e.date >= from) && (!to || e.date <= to)
  );
  const items = (itemRows as ItemRecord[]).filter((i) => i.entityType === "ITEM");

  const openingStock = items.reduce((s, i) => s + Number(i.purchasePrice ?? 0) * Number(i.openingStock ?? 0), 0);
  const totalSales = sales.reduce((s, x) => s + Number(x.total ?? 0), 0);
  const totalOtherChargesSales = sales.reduce((s, x) => s + Number(x.otherCharges ?? 0), 0);
  const totalDiscountSales = sales.reduce((s, x) => s + (x.lines ?? []).reduce((ls, l) => ls + Number(l.discount ?? 0), 0), 0);
  const paidPaymentSales = sales.filter((s) => s.paymentStatus === "fully_paid").reduce((s, x) => s + Number(x.total ?? 0), 0);
  const salesDue = sales.filter((s) => s.paymentStatus !== "fully_paid").reduce((s, x) => s + Number(x.total ?? 0), 0);
  const totalExpense = expenses.reduce((s, e) => s + Number(e.amount ?? 0), 0);
  const totalSalesReturn = returns.reduce((s, r) => s + Number(r.total ?? 0), 0);
  const grossProfit = totalSales - totalSalesReturn - openingStock;
  const netProfit = grossProfit - totalExpense;

  // Item-wise profit
  const itemMap: Record<string, ItemRecord> = Object.fromEntries(items.map((i) => [i.pk.replace("ITEM#", ""), i]));
  const itemWiseMap: Record<string, { name: string; qty: number; salesPrice: number; purchasePrice: number }> = {};
  for (const sale of sales) {
    for (const line of (sale.lines ?? [])) {
      const key = line.itemId || line.description;
      if (!itemWiseMap[key]) {
        const item = line.itemId ? itemMap[line.itemId] : null;
        itemWiseMap[key] = { name: item?.name || line.description, qty: 0, salesPrice: 0, purchasePrice: 0 };
      }
      itemWiseMap[key].qty += line.qty;
      itemWiseMap[key].salesPrice += line.lineTotal;
      if (line.itemId && itemMap[line.itemId]) {
        itemWiseMap[key].purchasePrice += Number(itemMap[line.itemId].purchasePrice ?? 0) * line.qty;
      }
    }
  }
  const itemWise = Object.values(itemWiseMap).map((d) => ({
    name: d.name,
    qty: d.qty,
    salesPrice: d.salesPrice,
    purchasePrice: d.purchasePrice,
    grossProfit: d.salesPrice - d.purchasePrice,
  }));

  res.json({
    period: { from, to },
    openingStock,
    totalSales,
    totalSalesTax: 0,
    totalOtherChargesSales,
    totalDiscountSales,
    paidPaymentSales,
    salesDue,
    totalExpense,
    totalSalesReturn,
    salesReturnDue: 0,
    grossProfit,
    netProfit,
    itemWise,
    // legacy
    revenue: totalSales,
    returnsTotal: totalSalesReturn,
    salesCount: sales.length,
    returnsCount: returns.length,
    expensesCount: expenses.length,
    net: netProfit,
  });
});

reportsRouter.get("/summary", async (req, res) => {
  const from = String(req.query.from || "");
  const to = String(req.query.to || "");
  if (!from || !to) {
    res.status(400).json({ error: "from and to required" });
    return;
  }
  const salesRows = (await scanByEntityPrefix("SALE#")) as SaleRecord[];
  const sales = salesRows.filter(
    (s) => s.entityType === "SALE" && s.deliveryDate >= from && s.deliveryDate <= to
  );
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
