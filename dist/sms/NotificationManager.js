/**
 * Notification Manager
 * ─────────────────────────────────────────────────────────────────────────────
 * The central hub for ALL outgoing SMS notifications.
 *
 * Data flow:
 *   Route / Cron
 *     → NotificationManager.fire(templateId, phone, data)
 *       → templateEngine.renderTemplate(template, data)
 *         → gateway.send(phone, renderedMessage)
 *           → Provider API  +  DynamoDB log
 *
 * Template resolution order (first match wins):
 *   1. DynamoDB SMSTEMPLATE#<id>  — user-edited overrides + custom templates
 *   2. Static TEMPLATE_REGISTRY   — built-in system templates
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { gateway } from "./gateway/smsGateway.js";
import { renderTemplate } from "./templateEngine.js";
import { TEMPLATE_REGISTRY } from "./templateRegistry.js";
import { config } from "../config.js";
import { getItem } from "../db/repo.js";
// ── Job Status → EventType Map ────────────────────────────────────────────────
export const JOB_STATUS_EVENT_MAP = {
    Placed: "JOB_PLACED",
    Done: "JOB_COMPLETED",
    JOB_DONE: "JOB_COMPLETED",
    Ready: "JOB_READY",
    Cancelled: "JOB_CANCELLED",
    Delayed: "JOB_DELAYED",
    OutForDelivery: "JOB_OUT_FOR_DELIVERY",
    // Sales order statuses
    "Ready to Deliver": "JOB_READY",
    Delivered: "JOB_COMPLETED",
    Returned: "JOB_CANCELLED",
};
// ── Notification Manager ──────────────────────────────────────────────────────
class NotificationManager {
    /**
     * Fire a notification for a given template ID.
     *
     * `templateId` may be:
     *  - A built-in EventType key (e.g. "JOB_PLACED", "BIRTHDAY")
     *  - A UUID of a user-created custom template stored in DynamoDB
     *
     * `{business_name}` and a default `{promo_code}` are injected automatically.
     * Any value in `data` overrides the defaults.
     *
     * @example
     * await notificationManager.fire("JOB_PLACED", "+94771234567", {
     *   customer_name: "Alice",
     *   job_id:        "S-2026-001",
     *   delivery_date: "26 Apr 2026",
     * });
     */
    async fire(templateId, phone, data) {
        if (!phone)
            return;
        // 1. Check DynamoDB (user overrides and fully custom templates)
        const dbRecord = await getItem(`SMSTEMPLATE#${templateId}`, "META");
        // 2. Fall back to static registry for built-in templates
        const systemTemplate = TEMPLATE_REGISTRY[templateId];
        let effectiveTemplate;
        if (dbRecord?.body) {
            effectiveTemplate = {
                id: templateId,
                name: dbRecord.name ?? systemTemplate?.name ?? templateId,
                category: dbRecord.category ?? systemTemplate?.category ?? "campaign",
                description: dbRecord.description ?? systemTemplate?.description,
                body: dbRecord.body,
            };
        }
        else if (systemTemplate) {
            effectiveTemplate = systemTemplate;
        }
        else {
            console.error(`[NotificationManager] No template found for: ${templateId}`);
            return;
        }
        const enriched = {
            business_name: config.sms.businessName,
            promo_code: "LAUNCH10",
            ...data,
        };
        const message = renderTemplate(effectiveTemplate, enriched);
        const result = await gateway.send(phone, message, { eventType: templateId });
        if (!result.success) {
            console.error(`[NotificationManager] ${templateId} → ${phone} FAILED: ${result.error}`);
        }
    }
    /**
     * Translate a raw job-status string into the matching EventType and fire.
     * If the status string has no mapping in JOB_STATUS_EVENT_MAP the call
     * is a silent no-op.
     */
    async onJobStatusChange(status, phone, data) {
        if (!phone)
            return;
        const eventType = JOB_STATUS_EVENT_MAP[status];
        if (!eventType)
            return;
        await this.fire(eventType, phone, data);
    }
}
/** Singleton instance — import `notificationManager` everywhere */
export const notificationManager = new NotificationManager();
