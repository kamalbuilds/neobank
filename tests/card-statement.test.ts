import { describe, expect, it } from "vitest";
import { authorizationIdFelt } from "@/server/card/authorization";
import {
  buildCardStatement,
  buildProofBundle,
  parseStatementQuery,
  renderProofText,
} from "@/server/card/statement";
import type { CardStatusProvider, SettledAuthorization } from "@/server/card/status";

const env = {
  CARD_RUNTIME_ACCOUNT_ADDRESS: "0x123",
  CARD_RUNTIME_PRIVATE_KEY: "private-do-not-return",
  CARD_SETTLEMENT_CONTRACT: "0x789",
  CARD_SETTLEMENT_TOKEN: "0x456",
  CARD_SETTLEMENT_UNITS_PER_USD: "1000000",
  CARD_WEBHOOK_SECRET: "webhook-do-not-return",
};

const fundedId = "iauth_dinner_1787803543";
const otherId = "iauth_other_1";
const felt = `0x${authorizationIdFelt(fundedId).toString(16)}`;

function settlement(
  authorizationId: string,
  amount: string,
  extras: Partial<SettledAuthorization> = {},
): SettledAuthorization {
  const felt = `0x${authorizationIdFelt(authorizationId).toString(16)}`;
  return {
    authorizationFelt: felt,
    transactionHash: extras.transactionHash || `0x${authorizationId.slice(-8)}`,
    explorerTransactionUrl: "https://sepolia.voyager.online/tx/0x1",
    recipient: "0x71",
    token: "0x456",
    amount,
    day: 1,
    blockNumber: extras.blockNumber ?? 10,
    lendAssets: extras.lendAssets,
    lendShares: extras.lendShares,
    vault: extras.vault,
  };
}

const twoNotes = {
  contractAddress: "0x789",
  explorerContractUrl: "https://sepolia.voyager.online/contract/0x789",
  settlements: [
    settlement(fundedId, "240000000000000000", {
      transactionHash: "0x4d94fa",
      lendAssets: "10000000000000000000",
      blockNumber: 14109923,
    }),
    settlement(otherId, "500000000000000000", {
      transactionHash: "0x63b3fe",
      blockNumber: 14083493,
    }),
  ],
};

describe("card statements", () => {
  it("returns settled:false and empty disclosures for an unknown authorization", async () => {
    const result = await buildCardStatement(
      {
        scope: "authorization",
        authorizationId: "iauth_missing",
        full: true,
      },
      { env, listSettlements: async () => twoNotes },
    );
    expect(result.settled).toBe(false);
    expect(result.disclosed).toEqual([]);
  });

  it("includes only the note that funded the named authorization", async () => {
    const result = await buildCardStatement(
      {
        scope: "authorization",
        authorizationId: fundedId,
        full: true,
      },
      { env, listSettlements: async () => twoNotes },
    );
    expect(result.settled).toBe(true);
    expect(result.disclosed).toHaveLength(1);
    expect(result.disclosed[0]?.transactionHash).toBe("0x4d94fa");
    expect(result.disclosed[0]?.amount).toBe("240000000000000000");
    expect(result.disclosed[0]?.lendAssets).toBe("10000000000000000000");
    expect(result.disclosed.map((row) => row.transactionHash)).not.toContain(
      "0x63b3fe",
    );
  });

  it("omits note amounts unless full=1", async () => {
    const result = await buildCardStatement(
      {
        scope: "authorization",
        authorizationId: fundedId,
        full: false,
      },
      { env, listSettlements: async () => twoNotes },
    );
    expect(result.disclosed[0]?.amount).toBeUndefined();
    expect(result.disclosed[0]?.lendAssets).toBeUndefined();
    expect(result.disclosed[0]?.transactionHash).toBe("0x4d94fa");
  });

  it("fails closed when runtime env is missing", async () => {
    await expect(
      buildCardStatement(
        { scope: "authorization", authorizationId: fundedId, full: false },
        { env: {}, listSettlements: async () => twoNotes },
      ),
    ).rejects.toThrow(/Card runtime missing/);
  });

  it("parses full=1 from the query string", () => {
    const url = new URL(
      "https://example/api/card/statement?scope=authorization&authorizationId=iauth_x&full=1",
    );
    expect(parseStatementQuery(url).full).toBe(true);
    expect(parseStatementQuery(new URL("https://example/api/card/statement")).full).toBe(
      false,
    );
  });
});

describe("card source-of-funds proof bundle", () => {
  const provider: CardStatusProvider = {
    getBlockNumber: async () => 14125886,
    callContract: async (call) => {
      if (call.entrypoint === "is_authorization_used") return ["0x1"];
      throw new Error(`unexpected entrypoint ${call.entrypoint}`);
    },
    getEvents: async (filter) => {
      const selector = filter.keys[0]?.[0];
      if (selector === "0x25226df400201d50b77f0e509a8b9bb61ef4e5c0d5c64d226df9e6b4a7f9652") {
        return {
          events: [
            {
              transaction_hash: "0x4d94fa79",
              keys: ["0xsettled", felt],
              data: ["0x71", "0x456", "0x354a6ba7a180000", "0x0", "0xd43"],
              block_number: 14111945,
            },
          ],
        };
      }
      if (selector === "0x31960ec076a3d81d6cec39d2ed55a01b54bdb977dcabdf787352460b2795822") {
        return {
          events: [
            {
              transaction_hash: "0x4d94fa79",
              keys: ["0xopened", felt],
              data: [
                "0xvault1",
                "0x8ac7230489e80000",
                "0x0",
                "0x8ac7230489e80000",
                "0x0",
              ],
              block_number: 14111945,
            },
          ],
        };
      }
      return { events: [] };
    },
  };

  it("builds a viewer-scoped proof with onchain origin on every numeric", async () => {
    const bundle = await buildProofBundle(fundedId, { env, provider });
    expect(bundle).toBeTruthy();
    expect(bundle?.cardholderAlias).toMatch(/^sof-[0-9a-f]{16}$/);
    expect(bundle?.authorizationId).toBe(fundedId);
    expect(bundle?.settledTxHash).toBe("0x4d94fa79");
    expect(bundle?.settleAmount.units).toBe("240000000000000000");
    expect(bundle?.settleAmount.origin.call.contractAddress).toBeTruthy();
    expect(bundle?.settleAmount.origin.call.blockNumber).toBe(14111945);
    expect(bundle?.positionActions.length).toBeGreaterThan(0);
    for (const action of bundle?.positionActions ?? []) {
      expect(action.amount.origin.call.blockNumber).toBeTypeOf("number");
    }
    expect(bundle?.generatedAtBlock).toBe(14125886);
  });

  it("returns null for an unknown id and never leaks ledger totals", async () => {
    const missing: CardStatusProvider = {
      ...provider,
      callContract: async (call) =>
        call.entrypoint === "is_authorization_used" ? ["0x0"] : [],
      getEvents: async () => ({ events: [] }),
    };
    const bundle = await buildProofBundle(otherId, { env, provider: missing });
    expect(bundle).toBeNull();
    const text = renderProofText({
      formatVersion: 1,
      cardholderAlias: "sof-0000000000000000",
      authorizationId: otherId,
      settledTxHash: "0xnone",
      settleAmount: {
        units: "0",
        decimals: 18,
        origin: {
          call: {
            contractAddress: "0x0",
            entrypoint: "AuthorizationSettled",
            blockNumber: 0,
            blockTag: "latest",
          },
        },
      },
      lenDidOnchainEventRef: false,
      positionActions: [],
      generatedAtBlock: 0,
      copy: "",
    });
    expect(text).not.toContain("totals");
    expect(text).not.toContain("accountAddress");
  });

  it("renders byte-identical text for identical inputs", async () => {
    const bundle = await buildProofBundle(fundedId, { env, provider });
    const first = renderProofText(bundle!);
    const second = renderProofText(bundle!);
    expect(first).toBe(second);
    expect(first).toContain("SOURCE-OF-FUNDS PROOF");
    expect(first).toContain("CARDHOLDER ALIAS:");
    expect(first.split("\n").some((line) => line.includes("blockNumber 14111945"))).toBe(true);
  });
});
