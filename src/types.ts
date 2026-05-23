export type EntityBase = {
  pk: string;
  sk: string;
  entityType: string;
  createdAt: string;
  updatedAt: string;
};

export type UserRecord = EntityBase & {
  entityType: "USER";
  email: string;
  passwordHash: string;
  name: string;
  phone?: string;
  roleId?: string;
  userNumber?: string;
};

export type CustomerRecord = EntityBase & {
  entityType: "CUSTOMER";
  customerNumber?: string;
  name: string;
  mobile?: string;
  phone?: string;
  email?: string;
  /** Date of birth in "YYYY-MM-DD" or "MM-DD" format — used by birthday SMS engine */
  dob?: string;
  gstNumber?: string;
  taxNumber?: string;
  country?: string;
  state?: string;
  city?: string;
  postcode?: string;
  address?: string;
  previousDue?: number;
  /** "percentage" | "fixed" */
  discountType?: string;
  /** Discount value — percentage (0-100) or fixed amount */
  discount?: number;
  status?: string;
};

export type ItemRecord = EntityBase & {
  entityType: "ITEM";
  itemNumber?: string;
  name: string;
  sku?: string;
  hsn?: string;
  categoryId?: string;
  brandId?: string;
  price: number;
  purchasePrice?: number;
  salesPrice?: number;
  finalPrice?: number;
  profitMargin?: number;
  discountType?: string;
  discount?: number;
  unit?: string;
  minimumQty?: number;
  openingStock?: number;
  expireDate?: string;
  barcode?: string;
  description?: string;
  taxName?: string;
  taxValue?: number;
  taxType?: string;
  status?: string;
};

export type CategoryRecord = EntityBase & {
  entityType: "CATEGORY";
  categoryCode?: string;
  name: string;
  kind: "item" | "expense";
  description?: string;
  status?: string;
};

export type BrandRecord = EntityBase & {
  entityType: "BRAND";
  brandCode?: string;
  name: string;
  description?: string;
  status?: string;
};

export type SalePayment = {
  id: string;
  date: string;
  paymentType: string;
  note?: string;
  amount: number;
};

export type SaleRecord = EntityBase & {
  entityType: "SALE";
  saleNumber: string;
  customerId?: string;
  customerName?: string;
  customerMobile?: string;
  deliveryDate: string;
  total: number;
  subtotal?: number;
  paidAmount?: number;
  status: string;
  paymentStatus?: string;
  otherCharges?: number;
  otherChargesType?: string;
  discountOnAll?: number;
  discountOnAllType?: string;
  roundOff?: number;
  referenceNo?: string;
  note?: string;
  sendSms?: boolean;
  createdBy?: string;
  payments?: SalePayment[];
  lines: { itemId?: string; description: string; qty: number; unitPrice: number; discount?: number; discountAmount?: number; unitCost?: number; lineTotal: number }[];
};

export type SaleReturnRecord = EntityBase & {
  entityType: "SALE_RETURN";
  originalSaleId?: string;
  total: number;
  reason?: string;
};

export type ExpenseRecord = EntityBase & {
  entityType: "EXPENSE";
  categoryId?: string;
  categoryName?: string;
  amount: number;
  date: string;
  note?: string;
  expenseFor?: string;
  referenceNo?: string;
  createdBy?: string;
  attachment?: {
    fileName: string;
    mimeType: string;
    size: number;
    url: string;
  };
};

export type ExpenseCategoryRecord = EntityBase & {
  entityType: "EXPENSE_CATEGORY";
  name: string;
  description?: string;
  status?: string;
};

export type RoleRecord = EntityBase & {
  entityType: "ROLE";
  name: string;
  permissions: string[];
};

export type SupplierRecord = EntityBase & {
  entityType: "SUPPLIER";
  supplierNumber?: string;
  name: string;
  mobile?: string;
  phone?: string;
  email?: string;
  gstNumber?: string;
  taxNumber?: string;
  country?: string;
  state?: string;
  city?: string;
  postcode?: string;
  address?: string;
  previousDue?: number;
  status?: string;
};

export type PurchaseRecord = EntityBase & {
  entityType: "PURCHASE";
  purchaseCode: string;
  supplierId?: string;
  supplierName?: string;
  purchaseDate: string;
  status: string;
  referenceNo?: string;
  total: number;
  subtotal: number;
  otherCharges?: number;
  otherChargesType?: string;
  discountOnAll?: number;
  discountOnAllType?: string;
  roundOff?: number;
  note?: string;
  paymentStatus?: string;
  createdBy?: string;
  lines: { itemId?: string; description: string; qty: number; purchasePrice: number; discount?: number; unitCost: number; lineTotal: number }[];
};

export type PurchaseReturnRecord = EntityBase & {
  entityType: "PURCHASE_RETURN";
  purchaseReturnCode: string;
  supplierId?: string;
  supplierName?: string;
  date: string;
  status: string;
  referenceNo?: string;
  total: number;
  subtotal: number;
  otherCharges?: number;
  discountOnAll?: number;
  roundOff?: number;
  note?: string;
  paymentStatus?: string;
  lines: { itemId?: string; description: string; qty: number; purchasePrice: number; discount?: number; unitCost: number; lineTotal: number }[];
};

export type SmsRecord = EntityBase & {
  entityType: "SMS";
  phone: string;
  message: string;
  status: string;
  /** The EventType that triggered this message (e.g. "JOB_PLACED") */
  eventType?: string;
  /** Provider used: "generic" | "twilio" | "notifylk" | "dev" */
  provider?: string;
  /** Error message if status is "failed" */
  error?: string;
};

/**
 * A global event stored in DynamoDB.
 * pk: SMSEVENT#<uuid>, sk: META
 * The daily cron job loads ALL events exclusively from this table.
 */
export type SmsEventRecord = EntityBase & {
  entityType: "SMS_EVENT";
  /** Human-readable label shown in the UI (e.g. "Summer Promo") */
  label: string;
  /** Month-Day in "MM-DD" format (e.g. "06-15") */
  date: string;
  /**
   * References a template. For built-in templates this matches the EventType
   * key (e.g. "BIRTHDAY"). For user-created templates it is a UUID.
   * Legacy records may use the field name `eventType` — both are read.
   */
  templateId: string;
  /** Optional promo code injected as {promo_code} */
  promoCode?: string;
};

/**
 * A template record stored in DynamoDB.
 * pk: SMSTEMPLATE#<templateId>, sk: META
 *
 * Two variants:
 *  - isCustom = false  →  body override of a system (registry) template
 *  - isCustom = true   →  fully user-created template; no registry entry exists
 *
 * NotificationManager always checks DynamoDB before falling back to the
 * static TEMPLATE_REGISTRY, so edits and new templates take effect
 * on the very next send.
 */
export type SmsTemplateRecord = EntityBase & {
  entityType: "SMS_TEMPLATE";
  /** Unique id — for system templates matches the EventType key */
  templateId: string;
  /** Human-readable name */
  name: string;
  /** UI grouping */
  category: "realtime" | "scheduled" | "campaign";
  /** One-line description of when this template fires */
  description?: string;
  /** Message body with {short_code} placeholders */
  body: string;
  /** true = user-created template, false = override of a built-in template */
  isCustom: boolean;
};
