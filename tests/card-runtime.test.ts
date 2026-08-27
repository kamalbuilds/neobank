import { constants, ec } from "starknet";
import { describe, expect, it, vi } from "vitest";
import {
  cardRuntimeStatus,
  deriveHostedViewingKey,
  ensurePoolFeeAllowance,
  isTerminalFinality,
  parseCardRuntimeConfig,
  selectSpendableNotes,
  usesVaultSpend,
  vaultRedeemSharesFor,
} from "@/server/card/runtime";
import type { Note } from "@starkware-libs/starknet-privacy-sdk";
import type { CardAuthorization } from "@/server/card/authorization";

const pool = "0x0254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91";

const dinnerAuth: CardAuthorization = {
  eventId: "evt_1",
  authorizationId: "iauth_vault_1",
  amountMinor: 24,
  amountUsdc: 240_000n,
  currency: "usd",
  merchantName: "Osteria Nova",
  merchantCountry: "US",
  merchantCategory: "restaurants",
};

describe("hosted private account runtime", () => {
  it("derives a deterministic canonical viewing key from the signer", () => {
    const privateKey = "0x12345";
    const first = deriveHostedViewingKey(
      privateKey,
      constants.StarknetChainId.SN_SEPOLIA,
      pool,
    );
    const second = deriveHostedViewingKey(
      privateKey,
      constants.StarknetChainId.SN_SEPOLIA,
      pool,
    );

    expect(first).toBe(second);
    expect(first).toBeGreaterThan(0n);
    expect(first).toBeLessThan(ec.starkCurve.CURVE.n >> 1n);
  });

  it("fails closed and names missing runtime capabilities", () => {
    const status = cardRuntimeStatus({});
    expect(status.ready).toBe(false);
    expect(status.missing).toEqual(
      expect.arrayContaining([
        "CARD_RUNTIME_ACCOUNT_ADDRESS",
        "CARD_RUNTIME_PRIVATE_KEY",
        "CARD_SETTLEMENT_CONTRACT",
        "CARD_SETTLEMENT_UNITS_PER_USD",
        "CARD_WEBHOOK_SECRET",
      ]),
    );
  });

  it("parses a complete Sepolia card runtime config", () => {
    const config = parseCardRuntimeConfig({
      CARD_RUNTIME_ACCOUNT_ADDRESS: "0x123",
      CARD_RUNTIME_PRIVATE_KEY: "0x456",
      CARD_SETTLEMENT_CONTRACT: "0x789",
      CARD_SETTLEMENT_TOKEN:
        "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
      CARD_SETTLEMENT_UNITS_PER_USD: "1000000000000000000",
      CARD_WEBHOOK_SECRET: "whsec_real",
      TESTNET_RPC: "https://rpc.example",
    });

    expect(config.rpcUrl).toBe("https://rpc.example");
    expect(config.provingUrl).toBe("https://transaction-prover.alpha-sepolia.sw-dev.io");
    expect(config.indexerUrl).toBe("https://discovery-service.alpha-sepolia.sw-dev.io");
    expect(config.poolAddress).toBe(pool);
    expect(config.settlementUnitsPerUsd).toBe(1_000_000_000_000_000_000n);
  });

  it("does not report pre-confirmed receipts as terminal", () => {
    expect(isTerminalFinality("PRE_CONFIRMED")).toBe(false);
    expect(isTerminalFinality("ACCEPTED_ON_L2")).toBe(true);
    expect(isTerminalFinality("ACCEPTED_ON_L1")).toBe(true);
    expect(isTerminalFinality("REJECTED")).toBe(true);
  });

  it("uses vault spend only when CARD_SPEND_FROM_VAULT=1", () => {
    expect(usesVaultSpend(dinnerAuth, {})).toBe(false);
    expect(usesVaultSpend(dinnerAuth, { CARD_SPEND_FROM_VAULT: "0" })).toBe(
      false,
    );
    expect(usesVaultSpend(dinnerAuth, { CARD_SPEND_FROM_VAULT: "1" })).toBe(
      true,
    );
  });

  it("redeem shares prefer CARD_LEND_UNITS and must cover settle", () => {
    const settle = 240_000_000_000_000_000n;
    expect(
      vaultRedeemSharesFor(settle, {
        CARD_LEND_UNITS: "10000000000000000000",
      }),
    ).toBe(10_000_000_000_000_000_000n);
    expect(vaultRedeemSharesFor(settle, { CARD_LEND_UNITS: "0" })).toBe(settle);
    expect(() =>
      vaultRedeemSharesFor(settle, { CARD_LEND_UNITS: "100" }),
    ).toThrow(/cover the settle amount/);
  });

  it("prefers mature open notes so vault-share receipts are spendable", () => {
    const witness = {} as Note["witness"];
    const notes: Note[] = [
      {
        id: 1n,
        amount: 10_000_000_000_000_000_000n,
        created: 100,
        witness,
        sender: 1n,
        open: true,
      },
      {
        id: 2n,
        amount: 8_000_000_000_000_000_000n,
        created: 100,
        witness,
        sender: 1n,
        open: false,
      },
      {
        id: 3n,
        amount: 10_000_000_000_000_000_000n,
        created: 200,
        witness,
        sender: 1n,
        open: true,
      },
    ];
    const picked = selectSpendableNotes(
      notes,
      10_000_000_000_000_000_000n,
      120,
    );
    expect(picked).toHaveLength(1);
    expect(picked[0]?.id).toBe(1n);
    expect(picked[0]?.open).toBe(true);
  });

  it("fails if auto-select would ignore the only open note", () => {
    const witness = {} as Note["witness"];
    const onlyOpen: Note[] = [
      {
        id: 9n,
        amount: 10_000_000_000_000_000_000n,
        created: 1,
        witness,
        sender: 1n,
        open: true,
      },
    ];
    const confidentialOnly = onlyOpen.filter((note) => !note.open);
    expect(confidentialOnly).toHaveLength(0);
    expect(
      selectSpendableNotes(onlyOpen, 10_000_000_000_000_000_000n, 20)[0]?.open,
    ).toBe(true);
  });

  it("does not re-approve when STRK allowance already covers the pool fee", async () => {
    const provider = {
      callContract: vi
        .fn()
        .mockResolvedValueOnce(["0x1bc16d674ec80000", "0x0"])
        .mockResolvedValueOnce(["0x8ac7230489e80000", "0x0"]),
      getTransactionReceipt: vi.fn(),
      getBlockNumber: vi.fn(),
    };
    const account = { execute: vi.fn() };
    const result = await ensurePoolFeeAllowance({
      provider: provider as never,
      account: account as never,
      accountAddress: "0x1",
      poolAddress: pool,
    });
    expect(result.approved).toBe(false);
    expect(result.fee).toBe(2_000_000_000_000_000_000n);
    expect(account.execute).not.toHaveBeenCalled();
  });
});
