/**
 * SMS Module — Public Barrel
 * ─────────────────────────────────────────────────────────────────────────────
 * Import everything SMS-related from this single entry-point.
 *
 * @example
 * import { notificationManager, TEMPLATE_REGISTRY } from "../sms/index.js";
 * import type { EventType, TemplateData } from "../sms/index.js";
 */
export { gateway } from "./gateway/smsGateway.js";
export { renderTemplate, extractShortCodes } from "./templateEngine.js";
export { TEMPLATE_REGISTRY } from "./templateRegistry.js";
export { notificationManager, JOB_STATUS_EVENT_MAP } from "./NotificationManager.js";
export { startEventEngine } from "./eventEngine.js";
