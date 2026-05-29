import { Router } from "express";
import { v4 as uuid } from "uuid";
import { deleteItem, getItem, putItem, scanByEntityPrefix, updateItem } from "../db/repo.js";
import type { CustomerRecord } from "../types.js";
import { authMiddleware } from "../middleware/auth.js";

const now = () => new Date().toISOString();

export const customersRouter = Router();
customersRouter.use(authMiddleware);

customersRouter.get("/", async (_req, res) => {
  const rows = await scanByEntityPrefix("CUSTOMER#");
  res.json({ customers: rows });
});

customersRouter.post("/", async (req, res) => {
  const b = req.body as Partial<CustomerRecord>;
  // Build name from salutation + firstName + lastName if not explicitly provided
  const derivedName =
    b.name?.trim() ||
    [b.salutation, b.firstName, b.lastName].filter(Boolean).join(" ");
  if (!derivedName) {
    res.status(400).json({ error: "name required" });
    return;
  }
  // Check mobile uniqueness
  const existing = await scanByEntityPrefix("CUSTOMER#");
  if (b.mobile?.trim()) {
    const duplicate = existing.find(
      (r) =>
        (r as CustomerRecord).entityType === "CUSTOMER" &&
        (r as CustomerRecord).mobile?.trim() === b.mobile!.trim()
    );
    if (duplicate) {
      res.status(409).json({ error: "Sorry! This mobile number already exist" });
      return;
    }
  }
  const count = existing.filter((r) => (r as { entityType?: string }).entityType === "CUSTOMER").length + 1;
  const customerNumber = `CU${String(count).padStart(4, "0")}`;
  const id = uuid();
  const rec: CustomerRecord = {
    pk: `CUSTOMER#${id}`,
    sk: "PROFILE",
    entityType: "CUSTOMER",
    customerNumber,
    salutation: b.salutation,
    firstName: b.firstName,
    lastName: b.lastName,
    name: derivedName,
    mobile: b.mobile?.trim() || undefined,
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
    discountType: b.discountType,
    discount: b.discount != null ? Number(b.discount) : undefined,
    status: b.status || "active",
    createdAt: now(),
    updatedAt: now(),
  };
  await putItem(rec);
  res.status(201).json({ id, ...rec });
});

customersRouter.post("/import", async (req, res) => {
  const { rows } = req.body as { rows?: Partial<CustomerRecord>[] };
  if (!Array.isArray(rows)) {
    res.status(400).json({ error: "rows array required" });
    return;
  }
  const existing = await scanByEntityPrefix("CUSTOMER#");
  let count = existing.filter((r) => (r as { entityType?: string }).entityType === "CUSTOMER").length;
  const created: string[] = [];
  for (const r of rows) {
    if (!r?.name) continue;
    count++;
    const id = uuid();
    const rec: CustomerRecord = {
      pk: `CUSTOMER#${id}`,
      sk: "PROFILE",
      entityType: "CUSTOMER",
      customerNumber: `CU${String(count).padStart(4, "0")}`,
      name: String(r.name),
      mobile: r.mobile,
      phone: r.phone,
      email: r.email,
      gstNumber: r.gstNumber,
      taxNumber: r.taxNumber,
      country: r.country,
      state: r.state,
      city: r.city,
      postcode: r.postcode,
      address: r.address,
      previousDue: r.previousDue != null ? Number(r.previousDue) : undefined,
      discountType: r.discountType,
      discount: r.discount != null ? Number(r.discount) : undefined,
      status: r.status || "active",
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
  const b = req.body as Partial<CustomerRecord>;
  // Check mobile uniqueness on update (skip current record)
  if (b.mobile?.trim()) {
    const all = await scanByEntityPrefix("CUSTOMER#");
    const duplicate = all.find(
      (r) =>
        (r as CustomerRecord).entityType === "CUSTOMER" &&
        (r as CustomerRecord).pk !== pk &&
        (r as CustomerRecord).mobile?.trim() === b.mobile!.trim()
    );
    if (duplicate) {
      res.status(409).json({ error: "Sorry! This mobile number already exist" });
      return;
    }
  }
  await updateItem(pk, "PROFILE", {
    ...(b.salutation != null ? { salutation: b.salutation } : {}),
    ...(b.firstName != null ? { firstName: b.firstName } : {}),
    ...(b.lastName != null ? { lastName: b.lastName } : {}),
    ...(b.name != null ? { name: b.name } : {}),
    ...(b.mobile != null ? { mobile: b.mobile } : {}),
    ...(b.phone != null ? { phone: b.phone } : {}),
    ...(b.email != null ? { email: b.email } : {}),
    ...(b.gstNumber != null ? { gstNumber: b.gstNumber } : {}),
    ...(b.taxNumber != null ? { taxNumber: b.taxNumber } : {}),
    ...(b.country != null ? { country: b.country } : {}),
    ...(b.state != null ? { state: b.state } : {}),
    ...(b.city != null ? { city: b.city } : {}),
    ...(b.postcode != null ? { postcode: b.postcode } : {}),
    ...(b.address != null ? { address: b.address } : {}),
    ...(b.previousDue != null ? { previousDue: Number(b.previousDue) } : {}),
    ...(b.discountType != null ? { discountType: b.discountType } : {}),
    ...(b.discount != null ? { discount: Number(b.discount) } : {}),
    ...(b.status != null ? { status: b.status } : {}),
    updatedAt: now(),
  });
  res.json({ ok: true });
});

customersRouter.delete("/:id", async (req, res) => {
  await deleteItem(`CUSTOMER#${req.params.id}`, "PROFILE");
  res.json({ ok: true });
});
