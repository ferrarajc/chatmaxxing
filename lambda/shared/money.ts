// ── Money parsing ────────────────────────────────────────────────────────────
//
// PURE MODULE — no AWS imports, no I/O, no React. Safe to import from any package.
//
// WHY THIS EXISTS: task-expert prompts instruct the LLM to emit amounts as human
// currency strings — PLACE_PURCHASE_PROMPT literally says `a specific dollar amount
// (e.g. "$5,000")` — and the agent can hand-edit the field on the proposed-action
// card before submitting. So `fields.amount` routinely arrives as "$4,800", "4,800",
// "$4,800.00" or " 4800 ".
//
// `parseFloat("$4,800")` is NaN, and `NaN <= 0` is FALSE, so every `amount <= 0`
// guard in execute-task silently passed NaN through into the holdings/balance math.
// DynamoDB rejects NaN ("Special numeric value NaN is not allowed"), the handler
// returned an opaque 500, and the agent saw "Submission failed — please try again."
// That fired for any amount the model wrote with a $ or a comma — i.e. most of them.
//
// Use parseMoney() for every currency field crossing the wire, and isValidAmount()
// (not `<= 0`) for every guard, so a NaN can never reach a write again.

/**
 * Parse a human-written currency string into a number.
 *
 * Accepts "$4,800", "4,800.00", "  4800 ", "-250.50". Returns NaN — never 0 — when
 * there is no parseable number, so callers can tell "unparseable" from "zero" and
 * reject the former with a real message. (The customer portal's BuyPage uses the
 * same strip with a `|| 0` fallback, which is right for a live input field and
 * wrong for a server-side guard.)
 */
export function parseMoney(raw: string | number | null | undefined): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : NaN;
  if (raw == null) return NaN;

  // Keep digits, decimal point, and a leading minus; drop $ , whitespace and any
  // trailing prose ("$500 per month" → 500).
  const cleaned = String(raw).replace(/[^0-9.\-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return NaN;

  // A minus is only meaningful in front; "4-800" is not negative four.
  const negative = cleaned.startsWith('-');
  const digits = cleaned.replace(/-/g, '');
  const n = parseFloat(digits);
  if (!Number.isFinite(n)) return NaN;
  return negative ? -n : n;
}

/** True when a parsed amount is a real, positive number safe to write. */
export function isValidAmount(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

/**
 * True when an amount field means "all of it" rather than a figure.
 *
 * Four task experts explicitly invite this — place-sale ("full redemption" / "all
 * shares"), exchange-funds and request-withdrawal ("full balance"), and
 * roth-conversion ("full balance") — and every one of them fed the phrase straight
 * into parseFloat, so the documented answer produced NaN and a failed submit. Callers
 * resolve the ceiling themselves (the position's value, the account's cash) because
 * only they know which one applies.
 */
export function isFullAmount(raw: string | null | undefined): boolean {
  if (!raw) return false;
  return /\b(full|entire|everything|all|max|maximum|whole)\b/i.test(String(raw));
}

/**
 * Resolve an amount field to a number: the stated ceiling when the client asked for
 * all of it, otherwise the parsed figure. Returns NaN when neither applies, so the
 * caller's isValidAmount() guard rejects it before any write.
 */
export function resolveAmount(raw: string | null | undefined, fullValue: number): number {
  if (isFullAmount(raw)) return fullValue;
  return parseMoney(raw);
}

/**
 * Parse a percentage ("10%", "10", " 7.5 % ") into a number. Same NaN contract as
 * parseMoney — used for tax withholding and beneficiary allocation fields.
 */
export function parsePercent(raw: string | number | null | undefined): number {
  return parseMoney(raw);
}

/**
 * Parse to a number, falling back to `fallback` when the value is unusable. For
 * optional numeric fields that have a sensible default (tax withholding's standard
 * 10%) — never for a field the client actually chose, where a silent default would
 * write a figure nobody agreed to. Those must be validated and rejected instead.
 */
export function numberOr(raw: string | number | null | undefined, fallback: number): number {
  const n = parseMoney(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** Format a number as a plain dollar string for customer- and agent-facing messages. */
export function formatMoney(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
