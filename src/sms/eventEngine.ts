/**
 * Automated Event Engine — Daily Cron Job
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs every day at 09:00 (server local time) and handles:
 *   1. Birthday greetings — checks the `dob` field on CustomerRecord
 *   2. Global events      — ALL events come from DynamoDB (SMSEVENT# records)
 *
 * ── How to add a new holiday / seasonal promo ─────────────────────────────
 *   Use the Event Manager tab in the SMS Dashboard UI to create an event.
 *   No code changes required.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import cron from "node-cron";
import { notificationManager } from "./NotificationManager.js";
import { scanByEntityPrefix, updateItem } from "../db/repo.js";
import type { CustomerRecord, SaleRecord } from "../types.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayMMDD(): string {
  const d = new Date();
  return (
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function dobToMMDD(dob: string): string {
  // "YYYY-MM-DD" → "MM-DD"  |  "MM-DD" → unchanged
  return dob.length > 5 ? dob.slice(5, 10) : dob;
}

async function allReachableCustomers(): Promise<CustomerRecord[]> {
  const all = (await scanByEntityPrefix("CUSTOMER#")) as CustomerRecord[];
  return all.filter((c) => c.mobile || c.phone);
}

// ── Runners ───────────────────────────────────────────────────────────────────

/** All scheduled events are read exclusively from DynamoDB */
async function runScheduledEvents(mmdd: string): Promise<void> {
  type DbEvent = {
    label: string;
    date: string;
    // templateId is the current field; eventType is the legacy name
    templateId?: string;
    eventType?: string;
    promoCode?: string;
  };
  const dbRows = (await scanByEntityPrefix("SMSEVENT#")) as DbEvent[];
  const todayEvents = dbRows.filter((e) => e.date === mmdd);

  if (todayEvents.length === 0) return;

  const customers = await allReachableCustomers();

  for (const event of todayEvents) {
    // Support both new `templateId` and legacy `eventType` field name
    const templateId = event.templateId ?? event.eventType;
    if (!templateId) continue;

    console.log(`[SMS Cron] ${event.label} — sending to ${customers.length} customer(s)`);
    for (const customer of customers) {
      const phone = (customer.mobile ?? customer.phone)!;
      await notificationManager.fire(templateId, phone, {
        customer_name: customer.name,
        promo_code:    event.promoCode ?? templateId,
      });
    }
  }
}

async function runBirthdayGreetings(mmdd: string): Promise<void> {
  const all = (await scanByEntityPrefix("CUSTOMER#")) as CustomerRecord[];
  const celebrants = all.filter(
    (c) => c.dob && dobToMMDD(c.dob) === mmdd && (c.mobile || c.phone)
  );

  if (celebrants.length === 0) return;
  console.log(`[SMS Cron] Birthdays — ${celebrants.length} customer(s) today`);

  for (const customer of celebrants) {
    const phone = (customer.mobile ?? customer.phone)!;
    await notificationManager.fire("BIRTHDAY", phone, {
      customer_name: customer.name,
      promo_code:    "BDAY10",
    });
  }
}

async function runSaleStatusUpdates(): Promise<void> {
  const allSales = (await scanByEntityPrefix("SALE#")).filter(
    (r) => (r as any).entityType === "SALE"
  ) as SaleRecord[];

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  let readyCount = 0;
  let deliveredCount = 0;

  for (const sale of allSales) {
    if (!sale.deliveryDate) continue;

    let newStatus: string | null = null;
    let sendSmsOnChange = false;

    if (
      sale.deliveryDate === tomorrowStr &&
      sale.status !== "Ready to Deliver" &&
      sale.status !== "Delivered" &&
      sale.status !== "Returned" &&
      sale.status !== "Cancelled"
    ) {
      // Update status to "Ready to Deliver" — NO SMS sent at this stage
      newStatus = "Ready to Deliver";
      sendSmsOnChange = false;
      readyCount++;
    } else if (
      sale.deliveryDate <= todayStr &&
      sale.status !== "Delivered" &&
      sale.status !== "Returned" &&
      sale.status !== "Cancelled"
    ) {
      // Update status to "Delivered" on the delivery date — SMS IS sent
      newStatus = "Delivered";
      sendSmsOnChange = true;
      deliveredCount++;
    }

    if (newStatus) {
      await updateItem(sale.pk, "META", {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });

      // Only fire SMS when the order is actually delivered
      if (sendSmsOnChange) {
        const phone = sale.customerMobile;
        if (phone) {
          await notificationManager
            .fire("JOB_COMPLETED", phone, {
              customer_name: sale.customerName ?? "Valued Customer",
              job_id: sale.saleNumber,
              delivery_date: sale.deliveryDate,
            })
            .catch((err) =>
              console.error(`[SMS Cron] Delivery SMS error for ${sale.saleNumber}:`, err)
            );
        }
      }
    }
  }

  if (readyCount > 0 || deliveredCount > 0) {
    console.log(
      `[SMS Cron] Sales statuses updated — ${readyCount} Ready to Deliver, ${deliveredCount} Delivered`
    );
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

/**
 * Register the daily cron job.
 * Call once at server startup (already wired in src/index.ts).
 * Cron runs at 09:00 every day.
 */
export function startEventEngine(): void {
  cron.schedule("0 9 * * *", async () => {
    const mmdd = todayMMDD();
    console.log(`[SMS Cron] Daily run started — ${new Date().toISOString()}`);

    const results = await Promise.allSettled([
      runScheduledEvents(mmdd),
      runBirthdayGreetings(mmdd),
      runSaleStatusUpdates(),
    ]);

    results.forEach((r, i) => {
      const label = ["ScheduledEvents", "BirthdayGreetings", "SaleStatusUpdates"][i];
      if (r.status === "rejected") {
        console.error(`[SMS Cron] ${label} error:`, r.reason);
      }
    });

    console.log(`[SMS Cron] Daily run complete.`);
  });

  console.log("[SMS Cron] Event engine scheduled — runs daily at 09:00.");
}

