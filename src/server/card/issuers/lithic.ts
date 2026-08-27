import { createHmac, timingSafeEqual } from "node:crypto";
import type { CardAuthorization, CardPolicyDecision } from "../authorization.ts";

/**
 * Lithic Auth Stream Access (ASA) adapter.
 *
 * ASA is Lithic's real-time synchronous authorization decisioning webhook,
 * the direct analog of Stripe's `issuing_authorization.request`: Lithic
 * calls our responder endpoint during the live authorization (6s timeout)
 * and expects an APPROVED/decline result back.
 *
 * Signing follows the Standard Webhooks spec (Lithic's webhooks and ASA
 * requests are powered by Svix): the `webhook-id`, `webhook-timestamp`, and
 * `webhook-signature` headers, HMAC-SHA256 over
 * `{webhook-id}.{webhook-timestamp}.{rawBody}`, keyed by the base64 payload
 * of the `whsec_...` secret. `webhook-signature` may carry multiple
 * space-delimited `v1,<base64sig>` entries during secret rotation.
 * https://docs.lithic.com/docs/auth-stream-access-asa
 */

export type LithicHeaders = {
  get(name: string): string | null;
};

function normalizeSecret(secret: string): Buffer {
  const payload = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  return Buffer.from(payload, "base64");
}

export function verifyLithicSignature(
  rawBody: string,
  headers: LithicHeaders,
  secret: string,
  nowMs = Date.now(),
  toleranceSeconds = 300,
): boolean {
  if (!secret) return false;
  const id = headers.get("webhook-id");
  const timestampText = headers.get("webhook-timestamp");
  const signatureHeader = headers.get("webhook-signature");
  if (!id || !timestampText || !signatureHeader) return false;

  const timestamp = Number(timestampText);
  if (!Number.isInteger(timestamp)) return false;
  if (Math.abs(Math.floor(nowMs / 1000) - timestamp) > toleranceSeconds) return false;

  const signedContent = `${id}.${timestampText}.${rawBody}`;
  const key = normalizeSecret(secret);
  if (key.length === 0) return false;
  const expected = createHmac("sha256", key).update(signedContent).digest();

  const entries = signatureHeader.split(" ").filter(Boolean);
  return entries.some((entry) => {
    const commaIndex = entry.indexOf(",");
    if (commaIndex === -1) return false;
    const version = entry.slice(0, commaIndex);
    const signatureB64 = entry.slice(commaIndex + 1);
    if (version !== "v1") return false;
    let candidate: Buffer;
    try {
      candidate = Buffer.from(signatureB64, "base64");
    } catch {
      return false;
    }
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Parses a raw Lithic ASA `card_authorization.approval_request` payload
 * (the `CardAuthorization` object, sent unwrapped to the responder
 * endpoint) into our issuer-agnostic `CardAuthorization` shape.
 */
export function parseLithicAuthorization(rawBody: string): CardAuthorization {
  const event: unknown = JSON.parse(rawBody);
  if (!isRecord(event)) {
    throw new Error("Malformed Lithic authorization.");
  }
  const token = event.token;
  const amounts = event.amounts;
  if (typeof token !== "string" || !token || !isRecord(amounts) || !isRecord(amounts.cardholder)) {
    throw new Error("Malformed Lithic authorization.");
  }
  const cardholderAmount = amounts.cardholder;
  const rawAmountMinor = cardholderAmount.amount;
  const currency = cardholderAmount.currency;
  if (typeof rawAmountMinor !== "number" || !Number.isSafeInteger(rawAmountMinor) || rawAmountMinor <= 0) {
    throw new Error("Malformed Lithic authorization amount.");
  }
  if (currency !== "USD") {
    throw new Error("Unsupported Lithic authorization currency.");
  }
  const amountMinor: number = rawAmountMinor;

  const merchant = event.merchant;
  if (
    !isRecord(merchant) ||
    typeof merchant.descriptor !== "string" ||
    typeof merchant.country !== "string" ||
    typeof merchant.mcc !== "string"
  ) {
    throw new Error("Malformed Lithic merchant data.");
  }

  return {
    eventId: token,
    authorizationId: token,
    amountMinor,
    amountUsdc: BigInt(amountMinor) * 10_000n,
    currency: "usd",
    merchantName: merchant.descriptor,
    merchantCountry: merchant.country.toUpperCase(),
    // Lithic reports MCC codes rather than Stripe-style category names; keep
    // the raw MCC so CARD_BLOCKED_MERCHANT_CATEGORIES can list MCC codes.
    merchantCategory: merchant.mcc,
  };
}

export type LithicAsaResult =
  | "APPROVED"
  | "CHALLENGE"
  | "SUSPECTED_FRAUD"
  | "AVS_INVALID"
  | "INSUFFICIENT_FUNDS"
  | "DRIVER_NUMBER_INVALID"
  | "VEHICLE_NUMBER_INVALID"
  | "UNAUTHORIZED_MERCHANT"
  | "VELOCITY_EXCEEDED"
  | "CARD_PAUSED";

export type LithicAsaResponse = {
  result: LithicAsaResult;
  token: string;
};

/** Maps our issuer-agnostic policy decision to Lithic's ASA response body. */
export function lithicResponseFor(
  authorizationId: string,
  decision: CardPolicyDecision,
): LithicAsaResponse {
  if (decision.approved) {
    return { result: "APPROVED", token: authorizationId };
  }
  const result: LithicAsaResult =
    decision.reason === "amount_limit" ? "VELOCITY_EXCEEDED" : "UNAUTHORIZED_MERCHANT";
  return { result, token: authorizationId };
}
