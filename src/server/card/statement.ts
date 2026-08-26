import { authorizationIdFelt } from "./authorization.ts";
import {
  cardRuntimeStatus,
  parseCardRuntimeConfig,
} from "./runtime.ts";
import {
  listSettledAuthorizations,
  type CardStatusProvider,
  type SettledAuthorization,
} from "./status.ts";

type Environment = Readonly<Record<string, string | undefined>>;

export type StatementScope = "authorization" | "period";

export type StatementDisclosure = {
  authorizationFelt: string;
  transactionHash: string;
  explorerTransactionUrl: string;
  recipient?: string;
  token?: string;
  blockNumber?: number;
  vault?: string;
  amount?: string;
  lendAssets?: string;
  lendShares?: string;
};

export type CardStatement = {
  network: "sepolia";
  accountAddress: string;
  scope: StatementScope;
  authorizationId?: string;
  settled: boolean;
  fromBlock?: number;
  toBlock?: number;
  disclosed: StatementDisclosure[];
  totals?: {
    settlementCount: number;
    tokens: Array<{ token: string; amount: string }>;
  };
  copy: string;
};

export type StatementOptions = {
  env?: Environment;
  provider?: CardStatusProvider;
  listSettlements?: typeof listSettledAuthorizations;
};

function feltHex(authorizationId: string): string {
  return `0x${authorizationIdFelt(authorizationId).toString(16)}`;
}

function sameFelt(left: string, right: string): boolean {
  return BigInt(left) === BigInt(right);
}

function redactAmounts(
  item: SettledAuthorization,
  includeAmounts: boolean,
): StatementDisclosure {
  const base: StatementDisclosure = {
    authorizationFelt: item.authorizationFelt,
    transactionHash: item.transactionHash,
    explorerTransactionUrl: item.explorerTransactionUrl,
    recipient: item.recipient,
    token: item.token,
    blockNumber: item.blockNumber,
    vault: item.vault,
  };
  if (!includeAmounts) return base;
  return {
    ...base,
    amount: item.amount,
    lendAssets: item.lendAssets,
    lendShares: item.lendShares,
  };
}

function tokenTotals(items: SettledAuthorization[]) {
  const byToken = new Map<string, bigint>();
  for (const item of items) {
    const key = item.token || "unknown";
    byToken.set(key, (byToken.get(key) || 0n) + BigInt(item.amount || "0"));
  }
  return {
    settlementCount: items.length,
    tokens: [...byToken.entries()].map(([token, amount]) => ({
      token,
      amount: amount.toString(),
    })),
  };
}

export function parseStatementQuery(url: URL): {
  scope: StatementScope;
  authorizationId?: string;
  fromBlock?: number;
  toBlock?: number;
  full: boolean;
} {
  const scope = url.searchParams.get("scope") === "period" ? "period" : "authorization";
  const authorizationId = url.searchParams.get("authorizationId") || undefined;
  const fromRaw = url.searchParams.get("fromBlock");
  const toRaw = url.searchParams.get("toBlock");
  const fromBlock = fromRaw && /^\d+$/.test(fromRaw) ? Number(fromRaw) : undefined;
  const toBlock = toRaw && /^\d+$/.test(toRaw) ? Number(toRaw) : undefined;
  return {
    scope,
    authorizationId,
    fromBlock,
    toBlock,
    full: url.searchParams.get("full") === "1",
  };
}

export async function buildCardStatement(
  query: ReturnType<typeof parseStatementQuery>,
  options: StatementOptions = {},
): Promise<CardStatement> {
  const env = options.env || process.env;
  const status = cardRuntimeStatus(env);
  if (!status.ready) {
    throw new Error(`Card runtime missing: ${status.missing.join(", ")}`);
  }
  const config = parseCardRuntimeConfig(env);
  const list = options.listSettlements || listSettledAuthorizations;
  const listed = await list({ env, provider: options.provider });
  const includeAmounts = query.full;

  const copy =
    "This statement discloses hosted-account activity the operator can already see. It is not a regulator endorsement.";

  if (query.scope === "authorization") {
    if (!query.authorizationId) {
      throw new TypeError("authorizationId required");
    }
    const wanted = feltHex(query.authorizationId);
    const matches = listed.settlements.filter((item) =>
      sameFelt(item.authorizationFelt, wanted),
    );
    return {
      network: "sepolia",
      accountAddress: config.accountAddress,
      scope: "authorization",
      authorizationId: query.authorizationId,
      settled: matches.length > 0,
      disclosed: matches.map((item) => redactAmounts(item, includeAmounts)),
      copy,
    };
  }

  const fromBlock = query.fromBlock ?? 0;
  const toBlock = query.toBlock;
  const inPeriod = listed.settlements.filter((item) => {
    const block = item.blockNumber ?? 0;
    if (block < fromBlock) return false;
    if (toBlock !== undefined && block > toBlock) return false;
    return true;
  });
  return {
    network: "sepolia",
    accountAddress: config.accountAddress,
    scope: "period",
    settled: inPeriod.length > 0,
    fromBlock,
    toBlock,
    disclosed: inPeriod.map((item) => redactAmounts(item, includeAmounts)),
    totals: includeAmounts ? tokenTotals(inPeriod) : { settlementCount: inPeriod.length, tokens: [] },
    copy,
  };
}
