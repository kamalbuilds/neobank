import { describe, expect, it } from "vitest";
import { authorizationIdFelt } from "@/server/card/authorization";
import {
  buildCardStatement,
  parseStatementQuery,
} from "@/server/card/statement";
import type { SettledAuthorization } from "@/server/card/status";

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
