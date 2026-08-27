import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  lithicResponseFor,
  parseLithicAuthorization,
  verifyLithicSignature,
  type LithicHeaders,
} from "@/server/card/issuers/lithic";

const raw = JSON.stringify({
  token: "asa_evt_1",
  amounts: {
    cardholder: { amount: 4599, currency: "USD" },
    merchant: { amount: 4599, currency: "USD" },
  },
  merchant: {
    descriptor: "Corner Market",
    country: "USA",
    mcc: "5411",
    acceptor_id: "acc_1",
    acquiring_institution_id: "123",
    city: "New York",
    state: "NY",
  },
});

function headersFrom(map: Record<string, string>): LithicHeaders {
  return { get: (name) => map[name.toLowerCase()] ?? null };
}

/** Standard Webhooks (Svix) test key: base64 of a 24-byte secret. */
const TEST_SECRET = `whsec_${Buffer.from("neobank-lithic-asa-test-secret!").toString("base64")}`;

function signFor(id: string, timestamp: number, body: string, secret: string): string {
  const key = Buffer.from(secret.slice("whsec_".length), "base64");
  const signedContent = `${id}.${timestamp}.${body}`;
  const signature = createHmac("sha256", key).update(signedContent).digest("base64");
  return `v1,${signature}`;
}

describe("Lithic ASA trust boundary", () => {
  it("verifies a fresh Standard Webhooks signature and rejects tampering", () => {
    const timestamp = 1_800_000_000;
    const id = "msg_1";
    const signature = signFor(id, timestamp, raw, TEST_SECRET);
    const headers = headersFrom({
      "webhook-id": id,
      "webhook-timestamp": String(timestamp),
      "webhook-signature": signature,
    });

    expect(verifyLithicSignature(raw, headers, TEST_SECRET, timestamp * 1000)).toBe(true);
    expect(verifyLithicSignature(`${raw} `, headers, TEST_SECRET, timestamp * 1000)).toBe(false);
    expect(verifyLithicSignature(raw, headers, TEST_SECRET, (timestamp + 301) * 1000)).toBe(false);
    expect(verifyLithicSignature(raw, headers, "whsec_" + Buffer.from("wrong").toString("base64"), timestamp * 1000)).toBe(
      false,
    );
  });

  it("rejects a request missing any Standard Webhooks header", () => {
    const timestamp = 1_800_000_000;
    const signature = signFor("msg_1", timestamp, raw, TEST_SECRET);
    expect(
      verifyLithicSignature(
        raw,
        headersFrom({ "webhook-timestamp": String(timestamp), "webhook-signature": signature }),
        TEST_SECRET,
        timestamp * 1000,
      ),
    ).toBe(false);
  });

  it("accepts rotation-style multi-signature headers when one entry matches", () => {
    const timestamp = 1_800_000_000;
    const id = "msg_1";
    const good = signFor(id, timestamp, raw, TEST_SECRET);
    const headers = headersFrom({
      "webhook-id": id,
      "webhook-timestamp": String(timestamp),
      "webhook-signature": `v1,bm90dGhlcmlnaHRvbmU= ${good}`,
    });
    expect(verifyLithicSignature(raw, headers, TEST_SECRET, timestamp * 1000)).toBe(true);
  });

  it("normalizes a real ASA authorization request into our issuer-agnostic shape", () => {
    expect(parseLithicAuthorization(raw)).toEqual({
      eventId: "asa_evt_1",
      authorizationId: "asa_evt_1",
      amountMinor: 4599,
      amountUsdc: 45_990_000n,
      currency: "usd",
      merchantName: "Corner Market",
      merchantCountry: "USA",
      merchantCategory: "5411",
    });
  });

  it("rejects malformed or unsupported-currency payloads", () => {
    expect(() => parseLithicAuthorization(JSON.stringify({ token: "x" }))).toThrow();
    expect(() =>
      parseLithicAuthorization(
        JSON.stringify({
          token: "x",
          amounts: { cardholder: { amount: 100, currency: "EUR" } },
          merchant: { descriptor: "d", country: "USA", mcc: "5411" },
        }),
      ),
    ).toThrow();
  });

  it("maps policy decisions onto Lithic ASA result codes", () => {
    expect(lithicResponseFor("tok_1", { approved: true })).toEqual({
      result: "APPROVED",
      token: "tok_1",
    });
    expect(lithicResponseFor("tok_1", { approved: false, reason: "amount_limit" })).toEqual({
      result: "VELOCITY_EXCEEDED",
      token: "tok_1",
    });
    expect(lithicResponseFor("tok_1", { approved: false, reason: "country_blocked" })).toEqual({
      result: "UNAUTHORIZED_MERCHANT",
      token: "tok_1",
    });
    expect(
      lithicResponseFor("tok_1", { approved: false, reason: "merchant_category_blocked" }),
    ).toEqual({ result: "UNAUTHORIZED_MERCHANT", token: "tok_1" });
  });
});
