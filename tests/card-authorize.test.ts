import { describe, expect, it, vi } from "vitest";
import {
  buildIssuingAuthorizationEvent,
  stripeSignatureHeader,
} from "@/server/card/authorization";
import { handleCardAuthorization } from "@/server/card/authorize";

const env = {
  CARD_RUNTIME_ACCOUNT_ADDRESS: "0x123",
  CARD_RUNTIME_PRIVATE_KEY: "private-do-not-return",
  CARD_SETTLEMENT_CONTRACT: "0x789",
  CARD_SETTLEMENT_TOKEN: "0x456",
  CARD_SETTLEMENT_UNITS_PER_USD: "1000000",
  CARD_WEBHOOK_SECRET: "whsec_test",
  CARD_MAX_PER_TX_USDC: "500",
  CARD_ALLOWED_COUNTRIES: "US,GB,IN",
  CARD_BLOCKED_MERCHANT_CATEGORIES: "gambling",
};

const timestamp = 1_800_000_000;
const raw = buildIssuingAuthorizationEvent({
  eventId: "evt_auth_1",
  authorizationId: "iauth_1",
  amountMinor: 1234,
  merchantName: "Corner Market",
  merchantCountry: "US",
  merchantCategory: "grocery_stores",
});
const header = stripeSignatureHeader(raw, env.CARD_WEBHOOK_SECRET, timestamp);

describe("card authorization handler", () => {
  it("rejects an invalid signature without settling", async () => {
    const settle = vi.fn();
    const result = await handleCardAuthorization({
      rawBody: raw,
      signatureHeader: "t=1,v1=00",
      waitForSettlement: true,
      env,
      nowMs: timestamp * 1000,
      settle,
    });

    expect(result.httpStatus).toBe(401);
    expect(result.body).toEqual({
      approved: false,
      reason: "invalid_signature",
    });
    expect(settle).not.toHaveBeenCalled();
  });

  it("returns the onchain receipt and does not settle twice", async () => {
    const settle = vi.fn();
    const result = await handleCardAuthorization({
      rawBody: raw,
      signatureHeader: header,
      waitForSettlement: true,
      env,
      nowMs: timestamp * 1000,
      settle,
      readStatus: async () => ({
        authorizationId: "iauth_1",
        authorizationFelt: "0x1",
        settled: true,
        contractAddress: "0x789",
        explorerContractUrl: "https://sepolia.voyager.online/contract/0x789",
        transactionHash: "0xabc",
      }),
    });

    expect(result.httpStatus).toBe(200);
    expect(result.body.settlementStatus).toBe("confirmed");
    expect(result.body.approved).toBe(true);
    expect(settle).not.toHaveBeenCalled();
  });

  it("refuses a policy-blocked merchant without settling", async () => {
    const settle = vi.fn();
    const blocked = buildIssuingAuthorizationEvent({
      eventId: "evt_auth_2",
      authorizationId: "iauth_2",
      amountMinor: 50,
      merchantName: "Casino",
      merchantCountry: "US",
      merchantCategory: "gambling",
    });
    const result = await handleCardAuthorization({
      rawBody: blocked,
      signatureHeader: stripeSignatureHeader(
        blocked,
        env.CARD_WEBHOOK_SECRET,
        timestamp,
      ),
      waitForSettlement: true,
      env,
      nowMs: timestamp * 1000,
      settle,
      readStatus: async () => ({
        authorizationId: "iauth_2",
        authorizationFelt: "0x2",
        settled: false,
        contractAddress: "0x789",
        explorerContractUrl: "https://sepolia.voyager.online/contract/0x789",
      }),
    });

    expect(result.body).toEqual({
      approved: false,
      reason: "merchant_category_blocked",
    });
    expect(settle).not.toHaveBeenCalled();
  });

  it("queues settlement after returning the card decision", async () => {
    const settle = vi.fn().mockResolvedValue({
      authorizationId: "iauth_1",
      transactionHash: "0xabc",
      finalityStatus: "ACCEPTED_ON_L2",
      executionStatus: "SUCCEEDED",
      warnings: [],
    });
    const scheduled: Array<() => void | Promise<void>> = [];
    const result = await handleCardAuthorization({
      rawBody: raw,
      signatureHeader: header,
      waitForSettlement: false,
      env,
      nowMs: timestamp * 1000,
      settle,
      readStatus: async () => ({
        authorizationId: "iauth_1",
        authorizationFelt: "0x1",
        settled: false,
        contractAddress: "0x789",
        explorerContractUrl: "https://sepolia.voyager.online/contract/0x789",
      }),
      schedule: (work) => {
        scheduled.push(work);
      },
    });

    expect(result.httpStatus).toBe(202);
    expect(result.body).toEqual({
      approved: true,
      authorizationId: "iauth_1",
      settlementStatus: "queued",
    });
    expect(settle).not.toHaveBeenCalled();
    expect(scheduled).toHaveLength(1);
    await scheduled[0]();
    expect(settle).toHaveBeenCalledTimes(1);
  });
});
