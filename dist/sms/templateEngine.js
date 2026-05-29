/**
 * SMS Template Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Defines the SmsTemplate interface and the short-code parser.
 *
 * Short codes use {curly_brace} syntax:
 *   "Hi {customer_name}, your job #{job_id} is now {status}."
 *
 * Templates are stored in templateRegistry.ts.
 * This file is pure logic — no side-effects, no DB calls.
 */
// ── Parser ────────────────────────────────────────────────────────────────────
/**
 * Renders a template body by replacing all {short_code} tokens with
 * their values from `data`.
 *
 * - Known tokens are replaced with the data value.
 * - Unknown tokens are preserved as-is (e.g. `{unknown}`) so gaps are visible.
 *
 * @example
 * renderTemplate(tpl, { customer_name: "Alice", job_id: "S-001" })
 * // "Hi Alice, your job #S-001 is ready."
 */
export function renderTemplate(template, data) {
    return template.body.replace(/\{(\w+)\}/g, (_match, key) => {
        const val = data[key];
        if (val === undefined || val === null)
            return `{${key}}`;
        return String(val);
    });
}
/**
 * Returns the unique list of {short_code} tokens found in a template body.
 * Useful for validation, documentation, and UI display.
 */
export function extractShortCodes(body) {
    const matches = [...body.matchAll(/\{(\w+)\}/g)];
    return [...new Set(matches.map((m) => m[1]))];
}
