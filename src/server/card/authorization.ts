import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type CardAuthorization = {
  eventId: string;
  authorizationId: string;
  amountMinor: number;
  amountUsdc: bigint;
  currency: "usd";
  merchantName: string;
  merchantCountry: string;
  merchantCategory: string;
};

export type CardPolicy = {
  maxPerTransactionUsdc: bigint;
  allowedCountries: Set<string>;
  blockedCategories: Set<string>;
};

export type CardPolicyDecision =
  | { approved: true }
  | {
      approved: false;
      reason: "amount_limit" | "country_blocked" | "merchant_category_blocked";
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  nowMs = Date.now(),
  toleranceSeconds = 300,
): boolean {
  if (!signatureHeader || !secret) return false;

  const parts = signatureHeader.split(",");
  const timestampText = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!timestampText || signatures.length === 0) return false;

  const timestamp = Number(timestampText);
  if (!Number.isInteger(timestamp)) return false;
  if (Math.abs(Math.floor(nowMs / 1000) - timestamp) > toleranceSeconds) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest();
  return signatures.some((signature) => {
    if (!/^[0-9a-f]{64}$/i.test(signature)) return false;
    const candidate = Buffer.from(signature, "hex");
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  });
}

export function parseStripeAuthorization(rawBody: string): CardAuthorization {
  const event: unknown = JSON.parse(rawBody);
  if (!isRecord(event) || event.type !== "issuing_authorization.request") {
    throw new Error("Unsupported card event.");
  }
  if (typeof event.id !== "string" || !isRecord(event.data) || !isRecord(event.data.object)) {
    throw new Error("Malformed card event.");
  }

  const authorization = event.data.object;
  if (
    typeof authorization.id !== "string" ||
    !Number.isSafeInteger(authorization.amount) ||
    Number(authorization.amount) <= 0 ||
    authorization.currency !== "usd" ||
    !isRecord(authorization.merchant_data)
  ) {
    throw new Error("Malformed card authorization.");
  }

  const merchant = authorization.merchant_data;
  if (
    typeof merchant.name !== "string" ||
    typeof merchant.country !== "string" ||
    typeof merchant.category !== "string"
  ) {
    throw new Error("Malformed merchant data.");
  }

  const amountMinor = Number(authorization.amount);
  return {
    eventId: event.id,
    authorizationId: authorization.id,
    amountMinor,
    amountUsdc: BigInt(amountMinor) * 10_000n,
    currency: "usd",
    merchantName: merchant.name,
    merchantCountry: merchant.country.toUpperCase(),
    merchantCategory: merchant.category,
  };
}

export function authorizationIdFelt(authorizationId: string): bigint {
  const digest = createHash("sha256").update(authorizationId).digest("hex");
  const felt = BigInt(`0x${digest.slice(0, 62)}`);
  return felt === 0n ? 1n : felt;
}

export function evaluateCardPolicy(
  authorization: CardAuthorization,
  policy: CardPolicy,
): CardPolicyDecision {
  if (authorization.amountUsdc > policy.maxPerTransactionUsdc) {
    return { approved: false, reason: "amount_limit" };
  }
  if (!policy.allowedCountries.has(authorization.merchantCountry)) {
    return { approved: false, reason: "country_blocked" };
  }
  if (policy.blockedCategories.has(authorization.merchantCategory)) {
    return { approved: false, reason: "merchant_category_blocked" };
  }
  return { approved: true };
}

export function stripeSignatureHeader(
  rawBody: string,
  secret: string,
  timestampSeconds: number,
): string {
  const signature = createHmac("sha256", secret)
    .update(`${timestampSeconds}.${rawBody}`)
    .digest("hex");
  return `t=${timestampSeconds},v1=${signature}`;
}

export function buildIssuingAuthorizationEvent(input: {
  eventId: string;
  authorizationId: string;
  amountMinor: number;
  merchantName: string;
  merchantCountry: string;
  merchantCategory: string;
}): string {
  return JSON.stringify({
    id: input.eventId,
    type: "issuing_authorization.request",
    data: {
      object: {
        id: input.authorizationId,
        amount: input.amountMinor,
        currency: "usd",
        merchant_data: {
          name: input.merchantName,
          country: input.merchantCountry,
          category: input.merchantCategory,
        },
      },
    },
  });
}

export function usdcUnitsFromDecimal(
  value: string | undefined,
  fallback: string,
): bigint {
  const normalized = value || fallback;
  if (!/^\d+(\.\d{1,6})?$/.test(normalized)) {
    throw new Error("Invalid USDC policy amount.");
  }
  const [whole, fraction = ""] = normalized.split(".");
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
}

export function csvSet(value: string | undefined, fallback = ""): Set<string> {
  return new Set(
    (value || fallback)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

export function cardPolicyFromEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): CardPolicy {
  return {
    maxPerTransactionUsdc: usdcUnitsFromDecimal(env.CARD_MAX_PER_TX_USDC, "500"),
    allowedCountries: csvSet(env.CARD_ALLOWED_COUNTRIES, "US,GB,IN"),
    blockedCategories: csvSet(
      env.CARD_BLOCKED_MERCHANT_CATEGORIES,
      "gambling,betting,crypto_cash_advance",
    ),
  };
}

export function isDemoAuthorizeEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return env.CARD_DEMO_AUTHORIZE === "1";
}
