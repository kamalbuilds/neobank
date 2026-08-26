import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  authorizationIdFelt,
  cardPolicyFromEnv,
  evaluateCardPolicy,
  isDemoAuthorizeEnabled,
  lendAmountFor,
  parseStripeAuthorization,
  stripeSignatureHeader,
  verifyStripeSignature,
} from "@/server/card/authorization";

const raw = JSON.stringify({
  id: "evt_auth_1",
  type: "issuing_authorization.request",
  data: {
    object: {
      id: "iauth_1",
      amount: 1234,
      currency: "usd",
      merchant_data: { name: "Corner Market", country: "US", category: "grocery_stores" },
    },
  },
});

describe("card authorization trust boundary", () => {
  it("verifies a fresh Stripe-compatible signature and rejects tampering", () => {
    const secret = "whsec_test";
    const timestamp = 1_800_000_000;
    const signature = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
    const header = `t=${timestamp},v1=${signature}`;

    expect(verifyStripeSignature(raw, header, secret, timestamp * 1000)).toBe(true);
    expect(verifyStripeSignature(`${raw} `, header, secret, timestamp * 1000)).toBe(false);
    expect(verifyStripeSignature(raw, header, secret, (timestamp + 301) * 1000)).toBe(false);
  });

  it("normalizes a real issuing authorization request into USDC base units", () => {
    expect(parseStripeAuthorization(raw)).toEqual({
      eventId: "evt_auth_1",
      authorizationId: "iauth_1",
      amountMinor: 1234,
      amountUsdc: 12_340_000n,
      currency: "usd",
      merchantName: "Corner Market",
      merchantCountry: "US",
      merchantCategory: "grocery_stores",
    });
  });

  it("produces a stable non-zero felt authorization id", () => {
    expect(authorizationIdFelt("iauth_1")).toBe(authorizationIdFelt("iauth_1"));
    expect(authorizationIdFelt("iauth_1")).not.toBe(authorizationIdFelt("iauth_2"));
    expect(authorizationIdFelt("iauth_1")).toBeGreaterThan(0n);
  });

  it("builds a signature header that verifyStripeSignature accepts and rejects a different secret", () => {
    const header = stripeSignatureHeader(raw, "whsec_test", 1_800_000_000);
    expect(verifyStripeSignature(raw, header, "whsec_test", 1_800_000_000_000)).toBe(
      true,
    );
    expect(verifyStripeSignature(raw, header, "whsec_other", 1_800_000_000_000)).toBe(
      false,
    );
  });

  it("loads policy from env and keeps demo authorize fail-closed", () => {
    const policy = cardPolicyFromEnv({
      CARD_MAX_PER_TX_USDC: "10",
      CARD_ALLOWED_COUNTRIES: "GB",
      CARD_BLOCKED_MERCHANT_CATEGORIES: "grocery_stores",
    });
    expect(policy.maxPerTransactionUsdc).toBe(10_000_000n);
    expect(policy.allowedCountries.has("GB")).toBe(true);
    expect(policy.allowedCountries.has("US")).toBe(false);
    expect(isDemoAuthorizeEnabled({})).toBe(false);
    expect(isDemoAuthorizeEnabled({ CARD_DEMO_AUTHORIZE: "true" })).toBe(false);
    expect(isDemoAuthorizeEnabled({ CARD_DEMO_AUTHORIZE: "1" })).toBe(true);
  });

  it("lends only on restaurant categories and stays zero otherwise", () => {
    const dinner = parseStripeAuthorization(
      JSON.stringify({
        id: "evt_dinner",
        type: "issuing_authorization.request",
        data: {
          object: {
            id: "iauth_dinner",
            amount: 24,
            currency: "usd",
            merchant_data: {
              name: "Osteria Nova",
              country: "US",
              category: "restaurants",
            },
          },
        },
      }),
    );
    expect(
      lendAmountFor(dinner, { CARD_LEND_UNITS: "1000000000000000000" }),
    ).toBe(1_000_000_000_000_000_000n);
    expect(
      lendAmountFor(dinner, {
        CARD_LEND_UNITS: "1000000000000000000",
        CARD_LEND_CATEGORIES: "grocery_stores",
      }),
    ).toBe(0n);
    expect(lendAmountFor(parseStripeAuthorization(raw), { CARD_LEND_UNITS: "1000000000000000000" })).toBe(
      0n,
    );
  });

  it("enforces per-transaction, country, and merchant-category policy", () => {
    const authorization = parseStripeAuthorization(raw);
    const policy = {
      maxPerTransactionUsdc: 20_000_000n,
      allowedCountries: new Set(["US"]),
      blockedCategories: new Set(["gambling"]),
    };

    expect(evaluateCardPolicy(authorization, policy)).toEqual({ approved: true });
    expect(
      evaluateCardPolicy(authorization, { ...policy, maxPerTransactionUsdc: 10_000_000n }),
    ).toEqual({ approved: false, reason: "amount_limit" });
    expect(
      evaluateCardPolicy(authorization, { ...policy, allowedCountries: new Set(["GB"]) }),
    ).toEqual({ approved: false, reason: "country_blocked" });
    expect(
      evaluateCardPolicy(authorization, {
        ...policy,
        blockedCategories: new Set(["grocery_stores"]),
      }),
    ).toEqual({ approved: false, reason: "merchant_category_blocked" });
  });
});
