/**
 * Template Registry
 * ─────────────────────────────────────────────────────────────────────────────
 * THE single source of truth for every SMS message template.
 *
 * ── To edit a message ──────────────────────────────────────────────────────
 *   Change the `body` string of the relevant entry. No logic changes needed.
 *
 * ── To add a completely new event type ────────────────────────────────────
 *   1. Add the new value to the EventType union below.
 *   2. Add a matching entry to TEMPLATE_REGISTRY.
 *   3. Call notificationManager.fire("YOUR_EVENT", phone, data) from your code.
 *   Done — no other file needs to change.
 *
 * ── Available short codes ─────────────────────────────────────────────────
 *   {customer_name}   Customer's full name
 *   {job_id}          Sale/order reference number
 *   {status}          Human-readable status label
 *   {delivery_date}   Scheduled delivery date
 *   {amount}          Payment amount (e.g. "LKR 2,500")
 *   {due_date}        Payment due date
 *   {last_visit}      Date of customer's last order
 *   {offer_details}   Free-form offer description
 *   {expiry_date}     Offer expiry date
 *   {promo_code}      Discount / promo code
 *   {business_name}   Auto-injected from BUSINESS_NAME env var
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { SmsTemplate } from "./templateEngine.js";

// ── Event Type Union ──────────────────────────────────────────────────────────

export type EventType =
  // ── Real-time job lifecycle ──────────────────────────────────────
  | "JOB_PLACED"
  | "JOB_READY"
  | "JOB_COMPLETED"
  | "JOB_CANCELLED"
  | "JOB_DELAYED"
  | "JOB_OUT_FOR_DELIVERY"
  // ── Payment events ───────────────────────────────────────────────
  | "PAYMENT_RECEIVED"
  | "PAYMENT_DUE_REMINDER"
  // ── Scheduled: birthday ──────────────────────────────────────────
  | "BIRTHDAY"
  // ── Scheduled: fixed holidays ────────────────────────────────────
  | "NEW_YEAR"
  | "VALENTINES_DAY"
  | "EASTER"
  | "EID"
  | "CHRISTMAS"
  | "BOXING_DAY"
  // ── Custom campaigns — add new types here ↓ ─────────────────────
  | "PROMO_OFFER"
  | "REENGAGEMENT";

// ── Template Registry ─────────────────────────────────────────────────────────

export const TEMPLATE_REGISTRY: Record<EventType, SmsTemplate> = {

  // ════════════════════════════════════════════════════════════════
  // REAL-TIME JOB EVENTS
  // ════════════════════════════════════════════════════════════════

  JOB_PLACED: {
    id: "JOB_PLACED",
    name: "Job Placed",
    category: "realtime",
    description: "Sent the moment a new laundry order is created.",
    body: "Hi {customer_name}, your laundry job #{job_id} has been placed successfully. Expected delivery: {delivery_date}. Thank you for choosing {business_name}!",
  },

  JOB_READY: {
    id: "JOB_READY",
    name: "Job Ready for Collection",
    category: "realtime",
    description: "Sent when the laundry is washed, dried and ready to pick up.",
    body: "Hi {customer_name}, great news! Your laundry job #{job_id} is ready for collection. We're open 8 AM – 8 PM. See you soon! – {business_name}",
  },

  JOB_COMPLETED: {
    id: "JOB_COMPLETED",
    name: "Job Completed",
    category: "realtime",
    description: "Sent after the order has been handed over / fully done.",
    body: "Thank you {customer_name}! Your laundry job #{job_id} has been completed. We hope to see you again soon. – {business_name}",
  },

  JOB_CANCELLED: {
    id: "JOB_CANCELLED",
    name: "Job Cancelled",
    category: "realtime",
    description: "Sent when a customer's order is cancelled.",
    body: "Hi {customer_name}, your laundry job #{job_id} has been cancelled. Please contact us if you have any questions. – {business_name}",
  },

  JOB_DELAYED: {
    id: "JOB_DELAYED",
    name: "Job Delayed",
    category: "realtime",
    description: "Sent when processing is running behind schedule.",
    body: "Hi {customer_name}, we're sorry! Your laundry job #{job_id} is experiencing a slight delay. We'll update you as soon as it's ready. We apologise for the inconvenience. – {business_name}",
  },

  JOB_OUT_FOR_DELIVERY: {
    id: "JOB_OUT_FOR_DELIVERY",
    name: "Out for Delivery",
    category: "realtime",
    description: "Sent when a delivery agent is on the way.",
    body: "Hi {customer_name}, your laundry job #{job_id} is on its way! Our delivery agent is heading to your location now. – {business_name}",
  },

  // ════════════════════════════════════════════════════════════════
  // PAYMENT EVENTS
  // ════════════════════════════════════════════════════════════════

  PAYMENT_RECEIVED: {
    id: "PAYMENT_RECEIVED",
    name: "Payment Received",
    category: "realtime",
    description: "Sent when a payment is confirmed.",
    body: "Hi {customer_name}, we have received your payment of {amount} for laundry job #{job_id}. Your account is now up to date. Thank you! – {business_name}",
  },

  PAYMENT_DUE_REMINDER: {
    id: "PAYMENT_DUE_REMINDER",
    name: "Payment Due Reminder",
    category: "realtime",
    description: "Reminder for an outstanding balance.",
    body: "Hi {customer_name}, a friendly reminder that {amount} is outstanding on your laundry account. Please settle by {due_date} to avoid any service interruption. – {business_name}",
  },

  // ════════════════════════════════════════════════════════════════
  // SCHEDULED: BIRTHDAY
  // ════════════════════════════════════════════════════════════════

  BIRTHDAY: {
    id: "BIRTHDAY",
    name: "Birthday Greeting",
    category: "scheduled",
    description: "Sent daily at 09:00 to customers whose dob matches today.",
    body: "Happy Birthday {customer_name}! 🎂 Wishing you a wonderful day. As a birthday treat, enjoy 10% off your next laundry order. Use code: {promo_code}. – {business_name}",
  },

  // ════════════════════════════════════════════════════════════════
  // SCHEDULED: FIXED HOLIDAYS
  // ════════════════════════════════════════════════════════════════

  NEW_YEAR: {
    id: "NEW_YEAR",
    name: "New Year Greeting",
    category: "scheduled",
    description: "Sent to all customers on January 1st.",
    body: "Happy New Year {customer_name}! 🎉 Wishing you a fresh, clean start to the year. Enjoy 15% off your first order. Code: {promo_code}. – {business_name}",
  },

  VALENTINES_DAY: {
    id: "VALENTINES_DAY",
    name: "Valentine's Day",
    category: "scheduled",
    description: "Sent to all customers on February 14th.",
    body: "Happy Valentine's Day {customer_name}! 💝 Look your best for your loved one. 10% off today only. Code: {promo_code}. – {business_name}",
  },

  EASTER: {
    id: "EASTER",
    name: "Easter Greeting",
    category: "scheduled",
    description: "Sent to all customers on Easter Sunday.",
    body: "Happy Easter {customer_name}! 🐣 Celebrate in spotless style. Enjoy free express laundry today. Code: {promo_code}. – {business_name}",
  },

  EID: {
    id: "EID",
    name: "Eid Greeting",
    category: "scheduled",
    description: "Sent to all customers on Eid al-Fitr.",
    body: "Eid Mubarak {customer_name}! 🌙 Celebrate in your freshest clothes. 20% off all services today. Code: {promo_code}. – {business_name}",
  },

  CHRISTMAS: {
    id: "CHRISTMAS",
    name: "Christmas Greeting",
    category: "scheduled",
    description: "Sent to all customers on December 25th.",
    body: "Merry Christmas {customer_name}! 🎄 Warm wishes from our team. Enjoy free pickup & delivery today. Code: {promo_code}. – {business_name}",
  },

  BOXING_DAY: {
    id: "BOXING_DAY",
    name: "Boxing Day Promo",
    category: "scheduled",
    description: "Sent to all customers on December 26th.",
    body: "Boxing Day Sale {customer_name}! 📦 25% off all orders placed today. Use code: {promo_code}. Don't miss out! – {business_name}",
  },

  // ════════════════════════════════════════════════════════════════
  // CUSTOM CAMPAIGNS
  // ════════════════════════════════════════════════════════════════
  // Add new campaign event types above in the EventType union,
  // then add the template entry here. ↓

  PROMO_OFFER: {
    id: "PROMO_OFFER",
    name: "Promotional Offer",
    category: "campaign",
    description: "Manually triggered promotional message for any occasion.",
    body: "Hi {customer_name}! 🎁 {offer_details}. Valid until {expiry_date}. Use code: {promo_code}. – {business_name}",
  },

  REENGAGEMENT: {
    id: "REENGAGEMENT",
    name: "Re-engagement",
    category: "campaign",
    description: "Win back customers who haven't ordered recently.",
    body: "Hi {customer_name}, we miss you! Your last visit was on {last_visit}. Come back and enjoy {offer_details}. Use code: {promo_code}. – {business_name}",
  },
};
