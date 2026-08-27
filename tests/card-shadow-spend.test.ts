import { describe, expect, it } from "vitest";
import { hash } from "starknet";
import {
  deriveSpendIdentity,
  sepoliaShadowAnonymizer,
} from "@/server/card/shadow";
import {
  MAX_SHADOW_SPEND_UNITS,
  SHADOW_CHANGE_DUST,
  ShadowSpendConfigError,
  executeShadowSpend,
  parseStrkAmount,
  planShadowSpend,
  predictShadowAccountAddress,
  probeUnusedShadowNonce,
} from "@/server/card/shadow-spend";

const STRK =
  "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";
const RECIPIENT =
  "0x071c62dfb692c3821a9ef120919f388b4559cb2d414c7378da62e6bf7f4f494d";

const FIXTURE = {
  viewingKey: 0x1234567890abcdefn,
  user: 0xabc123n,
  anonymizer: sepoliaShadowAnonymizer!,
  // Read from the Sepolia anonymizer's get_shadow_account_class_hash view,
  // confirmed against a live simulation trace of a shadow spend.
  shadowClassHash:
    0x070e76435b6ddb74b11665d3bc3264aaf354f59329976f3ffcb03b2ab992b78fn,
} as const;

describe("parseStrkAmount", () => {
  it("parses decimal STRK into 18-decimal units", () => {
    expect(parseStrkAmount("0.1")).toBe(10n ** 17n);
    expect(parseStrkAmount("1")).toBe(10n ** 18n);
    expect(parseStrkAmount("2.5")).toBe(25n * 10n ** 17n);
    expect(parseStrkAmount("0.000000000000000001")).toBe(1n);
  });

  it("fails closed on malformed, zero, and above-cap amounts", () => {
    for (const bad of ["", "-1", "0", "0.0", "1e18", "0x10", "1.1234567890123456789"]) {
      expect(() => parseStrkAmount(bad), bad).toThrow(ShadowSpendConfigError);
    }
    expect(() => parseStrkAmount("5.000000000000000001")).toThrow(/cap/);
    expect(parseStrkAmount("5")).toBe(MAX_SHADOW_SPEND_UNITS);
  });
});

describe("planShadowSpend", () => {
  const base = {
    viewingKey: FIXTURE.viewingKey,
    user: FIXTURE.user,
    nonce: 0n,
    token: STRK,
    amount: 10n ** 17n,
    recipient: RECIPIENT,
    shadowClassHash: FIXTURE.shadowClassHash,
    anonymizer: FIXTURE.anonymizer,
  };

  it("derives the same identity as deriveSpendIdentity and funds spend + dust", () => {
    const plan = planShadowSpend(base);
    const identity = deriveSpendIdentity({
      viewingKey: FIXTURE.viewingKey,
      user: FIXTURE.user,
      dappName: "neobank-card",
      nonce: 0n,
      anonymizer: FIXTURE.anonymizer,
    });

    expect(plan.identity.commitment).toBe(identity.commitment);
    expect(plan.funded).toBe(base.amount + SHADOW_CHANGE_DUST);
    expect(plan.collectPolicy).toEqual({ type: "all" });
  });

  it("funds the address the deployed anonymizer computes, not the SDK primer mirror", () => {
    const plan = planShadowSpend(base);
    const expected = BigInt(
      hash.calculateContractAddressFromHash(
        plan.identity.commitment,
        FIXTURE.shadowClassHash,
        [],
        BigInt(FIXTURE.anonymizer),
      ),
    );
    expect(plan.fundingAddress).toBe(
      predictShadowAccountAddress(
        plan.identity.commitment,
        FIXTURE.shadowClassHash,
        BigInt(FIXTURE.anonymizer),
      ),
    );
    expect(BigInt(plan.fundingAddress)).toBe(expected);
    // The stale-primer SDK address must NOT be the funding target.
    expect(BigInt(plan.fundingAddress)).not.toBe(BigInt(plan.identity.addressHex));
  });

  it("shapes exactly one ERC-20 transfer through the shadow account", () => {
    const plan = planShadowSpend(base);
    expect(plan.spendCall.contractAddress).toBe(STRK);
    expect(plan.spendCall.entrypoint).toBe("transfer");
    // u256 calldata: recipient, amount.low, amount.high
    expect(plan.spendCall.calldata).toEqual([
      RECIPIENT,
      (10n ** 17n).toString(),
      "0",
    ]);
    // The transfer selector the anonymizer will compile is the standard one.
    expect(hash.getSelectorFromName(plan.spendCall.entrypoint)).toBe(
      hash.getSelectorFromName("transfer"),
    );
  });

  it("changes shadow address when the nonce changes", () => {
    const plan0 = planShadowSpend(base);
    const plan1 = planShadowSpend({ ...base, nonce: 1n });
    expect(plan0.fundingAddress).not.toBe(plan1.fundingAddress);
  });

  it("rejects bad amounts, recipients, and class hashes", () => {
    expect(() => planShadowSpend({ ...base, amount: 0n })).toThrow(/positive/);
    expect(() =>
      planShadowSpend({ ...base, amount: MAX_SHADOW_SPEND_UNITS + 1n }),
    ).toThrow(/cap/);
    expect(() => planShadowSpend({ ...base, recipient: "osteria" })).toThrow(
      /felt/,
    );
    expect(() => planShadowSpend({ ...base, shadowClassHash: 0n })).toThrow(
      /class hash/,
    );
  });
});

describe("probeUnusedShadowNonce", () => {
  const derive = (nonce: bigint) => {
    const identity = deriveSpendIdentity({
      viewingKey: FIXTURE.viewingKey,
      user: FIXTURE.user,
      dappName: "neobank-card",
      nonce,
      anonymizer: FIXTURE.anonymizer,
    });
    return predictShadowAccountAddress(
      identity.commitment,
      FIXTURE.shadowClassHash,
      identity.anonymizer,
    );
  };

  it("returns the first nonce whose derived address is not deployed", async () => {
    const deployed = new Set([derive(0n), derive(1n)]);
    const provider = {
      async getClassHashAt(address: string) {
        if (deployed.has(address)) return "0x123";
        throw new Error("RPC: starknet_getClassHashAt error: 20 Contract not found");
      },
    };
    await expect(probeUnusedShadowNonce(provider, derive)).resolves.toBe(2n);
  });

  it("rethrows RPC failures instead of aliasing a live nonce", async () => {
    const provider = {
      async getClassHashAt() {
        throw new Error("RPC: 503 gateway timeout");
      },
    };
    await expect(probeUnusedShadowNonce(provider, derive)).rejects.toThrow(
      /gateway timeout/,
    );
  });
});

describe("executeShadowSpend fail-closed", () => {
  it("throws when the card runtime env is missing", async () => {
    await expect(
      executeShadowSpend({ amount: 10n ** 17n }, {}),
    ).rejects.toThrow(/Card runtime missing/);
  });

  it("throws when no recipient is configured", async () => {
    const env = {
      CARD_RUNTIME_ACCOUNT_ADDRESS: "0x1",
      CARD_RUNTIME_PRIVATE_KEY: "0x2",
      CARD_SETTLEMENT_CONTRACT: "0x3",
      CARD_SETTLEMENT_TOKEN: STRK,
      CARD_SETTLEMENT_UNITS_PER_USD: "1000000000000000000",
      CARD_WEBHOOK_SECRET: "whsec_test",
    };
    await expect(
      executeShadowSpend({ amount: 10n ** 17n }, env),
    ).rejects.toThrow(/recipient/);
  });
});
