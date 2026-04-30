/**
 * @deprecated
 * Templates are now managed in templateRegistry.ts and rendered by templateEngine.ts.
 * This file re-exports from the new modules for backward compatibility.
 */

export type { SmsTemplate, TemplateData } from "./templateEngine.js";
export { renderTemplate, extractShortCodes } from "./templateEngine.js";
export type { EventType } from "./templateRegistry.js";
export { TEMPLATE_REGISTRY } from "./templateRegistry.js";


/**
 * Supported statuses that trigger an SMS.
 * Add new values here as the business evolves.
 */
export type JobStatus =
  | "Placed"
  | "Done"
  | "Ready"
  | "Cancelled"
  | "Delayed"
  | string; // allows unknown future statuses to fall through to the default

/**
 * Returns a personalised message for the given job status.
 * To add a new status: add a `case` block — nothing else changes.
 */
export function jobStatusMessage(
  status: JobStatus,
  customerName: string,
  saleNumber: string
): string {
  const name = customerName || "Valued Customer";
  const ref = saleNumber;

  switch (status) {
    case "Placed":
      return (
        `Hi ${name}, your laundry order #${ref} has been placed successfully. ` +
        `We'll notify you when it's ready. Thank you!`
      );

    case "Done":
      return (
        `Great news ${name}! Your laundry order #${ref} is done and ready ` +
        `for pickup. Thank you for choosing us!`
      );

    case "Ready":
      return (
        `Hi ${name}, your laundry order #${ref} is ready for collection! ` +
        `Our working hours are 8 AM – 8 PM.`
      );

    case "Cancelled":
      return (
        `Hi ${name}, your laundry order #${ref} has been cancelled. ` +
        `Please contact us if you have any questions.`
      );

    case "Delayed":
      return (
        `Hi ${name}, your laundry order #${ref} is running slightly late. ` +
        `We apologise for the inconvenience and will update you as soon as it's ready.`
      );

    // ← Add new cases here, e.g.:
    // case "OutForDelivery":
    //   return `Hi ${name}, your order #${ref} is out for delivery!`;

    default:
      return `Hi ${name}, the status of your laundry order #${ref} has been updated to: ${status}.`;
  }
}

// ── Seasonal / Occasion Templates ────────────────────────────────────────────

export function birthdayMessage(customerName: string): string {
  const name = customerName || "Valued Customer";
  return (
    `Happy Birthday ${name}! 🎂 Wishing you a wonderful day. ` +
    `As a birthday treat, enjoy 10% off your next laundry order. Code: BDAY10.`
  );
}
