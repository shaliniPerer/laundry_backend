/**
 * @deprecated
 * Use notificationManager.onJobStatusChange() from NotificationManager.ts instead.
 * Kept for backward compatibility with existing imports in routes/sales.ts.
 */
import { notificationManager } from "./NotificationManager.js";
export { JOB_STATUS_EVENT_MAP } from "./NotificationManager.js";
/**
 * @deprecated Use notificationManager.onJobStatusChange() directly.
 */
export async function onJobStatusChange(status, customerPhone, customerName, saleNumber, deliveryDate) {
    const data = {
        customer_name: customerName,
        job_id: saleNumber,
        delivery_date: deliveryDate ?? "—",
    };
    await notificationManager.onJobStatusChange(status, customerPhone, data);
}
