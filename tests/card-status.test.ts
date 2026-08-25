import { describe, expect, it, vi } from "vitest";
import {
  listSettledAuthorizations,
  readAuthorizationStatus,
  readCardRuntimeHealth,
  validateAuthorizationId,
} from "@/server/card/status";

const completeEnv = {
  CARD_RUNTIME_ACCOUNT_ADDRESS: "0x123",
  CARD_RUNTIME_PRIVATE_KEY: "private-do-not-return",
  CARD_SETTLEMENT_CONTRACT: "0x789",
  CARD_SETTLEMENT_TOKEN: "0x456",
  CARD_SETTLEMENT_UNITS_PER_USD: "1000000",
  CARD_WEBHOOK_SECRET: "webhook-do-not-return",
  CARD_RUNTIME_RPC_URL: "https://rpc.example",
  CARD_RUNTIME_PROVING_URL: "https://prover.example",
  CARD_RUNTIME_INDEXER_URL: "https://indexer.example",
} as const;

describe("card status APIs", () => {
  it("accepts Stripe-style authorization IDs", () => {
    expect(validateAuthorizationId("iauth_1P2xYz-ABC:def.ghi")).toBe(true);
  });

  it.each([
    ["empty", ""],
    ["too long", "a".repeat(129)],
    ["newline", "iauth_1\nforged"],
    ["control character", "iauth_\u001f"],
    ["delete character", "iauth_\u007f"],
  ])("rejects %s authorization IDs", (_name, authorizationId) => {
    expect(validateAuthorizationId(authorizationId)).toBe(false);
  });

  it("reports live runtime health without returning secrets", async () => {
    const provider = {
      getBlockNumber: vi.fn().mockResolvedValue(123),
      callContract: vi
        .fn()
        .mockResolvedValueOnce([
          "0x1",
          "0x2",
          "0x3",
          "0x456",
          "0x5",
          "0x0",
          "0x64",
          "0x0",
          "0x0",
        ])
        .mockResolvedValueOnce(["0x7", "0x9", "0x0"]),
      getEvents: vi.fn(),
    };
    const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    const result = await readCardRuntimeHealth({
      env: completeEnv,
      provider,
      fetcher,
    });

    expect(result).toMatchObject({
      configured: true,
      ready: true,
      network: "sepolia",
      health: {
        rpc: { ok: true, blockNumber: 123 },
        proving: { ok: true, status: 200 },
        indexer: { ok: true, status: 200 },
        cardSettlement: {
          ok: true,
          contractAddress: "0x789",
          config: {
            owner: "0x1",
            privacyPool: "0x2",
            settlementRecipient: "0x3",
            settlementToken: "0x456",
            maxPerTransaction: "5",
            dailyLimit: "100",
            frozen: false,
          },
          dailySpend: { day: 7, amount: "9" },
        },
      },
    });
    const json = JSON.stringify(result);
    expect(result.demoAuthorize).toBe(false);
    expect(json).not.toContain(completeEnv.CARD_RUNTIME_PRIVATE_KEY);
    expect(json).not.toContain(completeEnv.CARD_WEBHOOK_SECRET);
    expect(fetcher).toHaveBeenCalledWith(
      "https://prover.example/health",
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(fetcher).toHaveBeenCalledWith(
      "https://indexer.example/health",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("fails readiness closed when the environment is incomplete", async () => {
    const result = await readCardRuntimeHealth({
      env: {},
      provider: {
        getBlockNumber: vi.fn().mockResolvedValue(123),
        callContract: vi.fn(),
        getEvents: vi.fn(),
      },
      fetcher: vi.fn().mockResolvedValue({ ok: true, status: 200 }),
    });

    expect(result.configured).toBe(false);
    expect(result.ready).toBe(false);
    expect(result.missing).toContain("CARD_RUNTIME_PRIVATE_KEY");
  });

  it("fails readiness closed when configured values cannot be parsed", async () => {
    const result = await readCardRuntimeHealth({
      env: { ...completeEnv, CARD_SETTLEMENT_UNITS_PER_USD: "not-a-number" },
      provider: {
        getBlockNumber: vi.fn().mockResolvedValue(123),
        callContract: vi
          .fn()
          .mockResolvedValueOnce([
            "0x1",
            "0x2",
            "0x3",
            "0x456",
            "0x5",
            "0x0",
            "0x64",
            "0x0",
            "0x0",
          ])
          .mockResolvedValueOnce(["0x7", "0x9", "0x0"]),
        getEvents: vi.fn(),
      },
      fetcher: vi.fn().mockResolvedValue({ ok: true, status: 200 }),
    });

    expect(result.configured).toBe(false);
    expect(result.ready).toBe(false);
  });

  it("enables the demo authorize flag only when CARD_DEMO_AUTHORIZE is 1", async () => {
    const result = await readCardRuntimeHealth({
      env: { ...completeEnv, CARD_DEMO_AUTHORIZE: "1" },
      provider: {
        getBlockNumber: vi.fn().mockResolvedValue(123),
        callContract: vi
          .fn()
          .mockResolvedValueOnce([
            "0x1",
            "0x2",
            "0x3",
            "0x456",
            "0x5",
            "0x0",
            "0x64",
            "0x0",
            "0x0",
          ])
          .mockResolvedValueOnce(["0x7", "0x9", "0x0"]),
        getEvents: vi.fn(),
      },
      fetcher: vi.fn().mockResolvedValue({ ok: true, status: 200 }),
    });
    expect(result.demoAuthorize).toBe(true);
  });

  it("reads authorization status without requiring the hosted private key", async () => {
    const provider = {
      getBlockNumber: vi.fn(),
      callContract: vi.fn().mockResolvedValue(["0x1"]),
      getEvents: vi.fn(),
    };

    const result = await readAuthorizationStatus("iauth_123", {
      env: {
        CARD_SETTLEMENT_CONTRACT: "0x789",
        CARD_RUNTIME_RPC_URL: "https://rpc.example",
      },
      provider,
    });

    expect(result.settled).toBe(true);
    expect(result.contractAddress).toBe("0x789");
    expect(provider.callContract).toHaveBeenCalled();
  });

  it("parses AuthorizationSettled using the live Sepolia event shape", async () => {
    const provider = {
      getBlockNumber: vi.fn(),
      callContract: vi.fn(),
      getEvents: vi.fn().mockResolvedValue({
        events: [
          {
            transaction_hash:
              "0x63b3fe7e13e9baca4d0a9ca9616b7b5e71504b38ed02bb3b98512935988acf4",
            keys: [
              "0x25226df400201d50b77f0e509a8b9bb61ef4e5c0d5c64d226df9e6b4a7f9652",
              "0x46f683bc9a9462554e49104f6fd3109971c11a020c996d97391744947c3fa8",
            ],
            data: [
              "0x71c62dfb692c3821a9ef120919f388b4559cb2d414c7378da62e6bf7f4f494d",
              "0x4718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
              "0x6f05b59d3b20000",
              "0x0",
              "0x50d3",
            ],
            block_number: 14083493,
          },
          {
            transaction_hash: "0xdead",
            keys: ["0xselector-only"],
            data: ["0x1"],
          },
        ],
      }),
    };

    const result = await listSettledAuthorizations({
      env: {
        CARD_SETTLEMENT_CONTRACT:
          "0x074dcd5ee5e0fbfdcf25a7cbc3408711de19fccdf46e8f53c71d35e795f5390a",
        CARD_SETTLEMENT_DEPLOY_BLOCK: "14083122",
        CARD_RUNTIME_RPC_URL: "https://rpc.example",
      },
      provider,
    });

    expect(result.settlements).toHaveLength(1);
    expect(result.settlements[0]).toMatchObject({
      amount: "500000000000000000",
      authorizationFelt:
        "0x46f683bc9a9462554e49104f6fd3109971c11a020c996d97391744947c3fa8",
      transactionHash:
        "0x63b3fe7e13e9baca4d0a9ca9616b7b5e71504b38ed02bb3b98512935988acf4",
      day: 20691,
    });
  });

  it("reads the onchain replay map without inventing a transaction hash", async () => {
    const provider = {
      getBlockNumber: vi.fn(),
      callContract: vi.fn().mockResolvedValue(["0x1"]),
      getEvents: vi.fn(),
    };

    const result = await readAuthorizationStatus("iauth_123", {
      env: completeEnv,
      provider,
    });

    expect(result).toMatchObject({
      authorizationId: "iauth_123",
      authorizationFelt: expect.stringMatching(/^0x[0-9a-f]+$/),
      settled: true,
      contractAddress: "0x789",
      explorerContractUrl: "https://sepolia.voyager.online/contract/0x789",
    });
    expect(result).not.toHaveProperty("transactionHash");
    expect(provider.getEvents).not.toHaveBeenCalled();
  });

  it("bounds AuthorizationSettled event lookup to 20 pages of 100", async () => {
    const provider = {
      getBlockNumber: vi.fn(),
      callContract: vi.fn().mockResolvedValue(["0x1"]),
      getEvents: vi.fn().mockImplementation(async () => ({
        events: [],
        continuation_token: "next",
      })),
    };

    const result = await readAuthorizationStatus("iauth_123", {
      env: { ...completeEnv, CARD_SETTLEMENT_DEPLOY_BLOCK: "100" },
      provider,
    });

    expect(result.settled).toBe(true);
    expect(result).not.toHaveProperty("transactionHash");
    expect(provider.getEvents).toHaveBeenCalledTimes(20);
    expect(provider.getEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        from_block: { block_number: 100 },
        to_block: "latest",
        address: "0x789",
        chunk_size: 100,
      }),
    );
  });

  it("returns the matching AuthorizationSettled transaction hash", async () => {
    const provider = {
      getBlockNumber: vi.fn(),
      callContract: vi.fn().mockResolvedValue(["0x1"]),
      getEvents: vi.fn().mockResolvedValue({
        events: [{ transaction_hash: "0xabc" }],
      }),
    };

    const result = await readAuthorizationStatus("iauth_123", {
      env: { ...completeEnv, CARD_SETTLEMENT_DEPLOY_BLOCK: "100" },
      provider,
    });

    expect(result.transactionHash).toBe("0xabc");
    expect(result.explorerTransactionUrl).toBe(
      "https://sepolia.voyager.online/tx/0xabc",
    );
  });

  it("keeps settled=true when best-effort event lookup is unavailable", async () => {
    const provider = {
      getBlockNumber: vi.fn(),
      callContract: vi.fn().mockResolvedValue(["0x1"]),
      getEvents: vi.fn().mockRejectedValue(new Error("RPC event limit")),
    };

    const result = await readAuthorizationStatus("iauth_123", {
      env: { ...completeEnv, CARD_SETTLEMENT_DEPLOY_BLOCK: "100" },
      provider,
    });

    expect(result.settled).toBe(true);
    expect(result).not.toHaveProperty("transactionHash");
  });
});
