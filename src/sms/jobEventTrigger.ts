/**
 * @deprecated
 * Use notificationManager.onJobStatusChange() from NotificationManager.ts instead.
 * Kept for backward compatibility with existing imports in routes/sales.ts.
 */

import { notificationManager } from "./NotificationManager.js";
import type { TemplateData } from "./templateEngine.js";

export { JOB_STATUS_EVENT_MAP } from "./NotificationManager.js";

/**
 * @deprecated Use notificationManager.onJobStatusChange() directly.
 */
export async function onJobStatusChange(
  status: string,
  customerPhone: string | undefined,
  customerName: string,
  saleNumber: string,
  deliveryDate?: string
): Promise<void> {
  const data: TemplateData = {
    customer_name: customerName,
    job_id:        saleNumber,
    delivery_date: deliveryDate ?? "—",
  };
  await notificationManager.onJobStatusChange(status, customerPhone, data);
}

