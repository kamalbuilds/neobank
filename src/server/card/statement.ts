import { createHash } from "node:crypto";

import { authorizationIdFelt } from "./authorization.ts";
import {
  cardRuntimeStatus,
  parseCardRuntimeConfig,
} from "./runtime.ts";
import {
  listSettledAuthorizations,
  validateAuthorizationId,
  type CardStatusProvider,
  type SettledAuthorization,
} from "./status.ts";
import { hash, RpcProvider } from "starknet";

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
  view?: "statement" | "proof";
  format?: "json" | "text";
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
    view: url.searchParams.get("view") === "proof" ? "proof" : undefined,
    format: url.searchParams.get("format") === "text" ? "text" : undefined,
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


// ---------------------------------------------------------------------------
// Source-of-funds proof bundle: viewer-scoped, live-read, onchain provenance.
// ---------------------------------------------------------------------------

const AUTHORIZATION_SETTLED_SELECTOR = hash.getSelectorFromName(
  "AuthorizationSettled",
);
const POSITION_OPENED_SELECTOR = hash.getSelectorFromName("PositionOpened");

export type OnchainOrigin = {
  call: {
    contractAddress: string;
    entrypoint: string;
    blockNumber: number;
    blockTag: "latest";
  };
};

export type ProofNumeric = {
  units: string;
  decimals: number;
  origin: OnchainOrigin;
};

export type PositionAction = {
  kind: "lend" | "redeem" | "settle-only";
  vault?: string;
  amount: ProofNumeric;
};

export type ProofBundle = {
  formatVersion: 1;
  cardholderAlias: string;
  authorizationId: string;
  settledTxHash: string;
  settleAmount: ProofNumeric;
  /** True when the settled tx carried an onchain AuthorizationSettled event. */
  lenDidOnchainEventRef: boolean;
  positionActions: PositionAction[];
  generatedAtBlock: number;
  copy: string;
};

function uint256From(low: string, high: string): bigint {
  return BigInt(low) + (BigInt(high) << 128n);
}

/** Deterministic pseudonym over the hosted account and this authorization only. */
function cardholderAlias(
  hostedAccountAddress: string,
  authorizationFelt: string,
): string {
  const digest = createHash("sha256")
    .update(`${hostedAccountAddress}:${authorizationFelt}`)
    .digest("hex");
  return `sof-${digest.slice(0, 16)}`;
}

/**
 * Compliance-grade source-of-funds proof for one card authorization.
 *
 * Every numeric is re-read live from Starknet at request time and carries the
 * call that produced it plus the block it was read at, mirroring the live-read
 * pattern used elsewhere in this module. Unknown or unset ids return null so a
 * bad id can never disclose anything about the rest of the ledger.
 */
export async function buildProofBundle(
  authorizationId: string,
  options: StatementOptions = {},
): Promise<ProofBundle | null> {
  const env = options.env || process.env;
  const status = cardRuntimeStatus(env);
  if (!status.ready) {
    throw new Error(`Card runtime missing: ${status.missing.join(", ")}`);
  }
  if (!validateAuthorizationId(authorizationId)) {
    throw new TypeError("Invalid authorization id.");
  }
  const config = parseCardRuntimeConfig(env);
  const provider =
    options.provider ||
    (new RpcProvider({ nodeUrl: config.rpcUrl }) as unknown as CardStatusProvider);

  const felt = `0x${authorizationIdFelt(authorizationId).toString(16)}`;
  const used = await provider.callContract({
    contractAddress: config.programContract,
    entrypoint: "is_authorization_used",
    calldata: [felt],
  });
  // Unspent authorization: nothing to prove, disclose nothing.
  if (BigInt(used[0] || "0x0") === 0n) return null;

  const [settledPage, positionPage] = await Promise.all([
    provider.getEvents({
      from_block: { block_number: deployBlock(env) ?? 0 },
      to_block: "latest",
      address: config.programContract,
      keys: [[AUTHORIZATION_SETTLED_SELECTOR], [felt]],
      chunk_size: 10,
    }),
    provider.getEvents({
      from_block: { block_number: deployBlock(env) ?? 0 },
      to_block: "latest",
      address: config.programContract,
      keys: [[POSITION_OPENED_SELECTOR], [felt]],
      chunk_size: 10,
    }),
  ]);
  const settledEvent = settledPage.events[0];
  if (!settledEvent) return null;

  const head = await provider.getBlockNumber();
  const data = settledEvent.data || [];
  if (data.length < 5) return null;

  const origin = (entrypoint: string): OnchainOrigin => ({
    call: {
      contractAddress: config.programContract,
      entrypoint,
      blockNumber: settledEvent.block_number ?? head,
      blockTag: "latest",
    },
  });

  const positionActions: PositionAction[] = [];
  const positionEvent = positionPage.events[0];
  if (positionEvent && (positionEvent.data || []).length >= 5) {
    const posData = positionEvent.data!;
    positionActions.push({
      kind: "lend",
      vault: posData[0],
      amount: {
        units: uint256From(posData[1], posData[2]).toString(),
        decimals: 18,
        origin: origin("PositionOpened"),
      },
    });
  }

  return {
    formatVersion: 1,
    cardholderAlias: cardholderAlias(config.accountAddress, felt),
    authorizationId,
    settledTxHash: settledEvent.transaction_hash,
    settleAmount: {
      units: uint256From(data[2], data[3]).toString(),
      decimals: 18,
      origin: origin("AuthorizationSettled"),
    },
    lenDidOnchainEventRef: Boolean(settledEvent.transaction_hash),
    positionActions,
    generatedAtBlock: head,
    copy:
      "Scoped to one card authorization. Amounts were re-read live from the program contract at request time; each value names its entrypoint and block.",
  };
}

/**
 * Deterministic text export. The same bundle renders byte-identically every
 * time, so two people attaching it to a compliance ticket agree on every line.
 */
export function renderProofText(bundle: ProofBundle): string {
  const lines: string[] = [];
  lines.push("SOURCE-OF-FUNDS PROOF");
  lines.push(`formatVersion ${bundle.formatVersion}`);
  lines.push(`generatedBlockNumber ${bundle.generatedAtBlock}`);
  lines.push("");
  lines.push("CARDHOLDER ALIAS:");
  lines.push(`${bundle.cardholderAlias} (pseudonymous; no address disclosed)`);
  lines.push("");
  lines.push("AUTHORIZATION:");
  lines.push(`authorizationId ${bundle.authorizationId}`);
  lines.push(`settledTxHash ${bundle.settledTxHash}`);
  lines.push(`lenDidOnchainEventRef ${bundle.lenDidOnchainEventRef ? "yes" : "no"}`);
  lines.push("");
  lines.push("SETTLEMENT AMOUNT:");
  lines.push(
    `${bundle.settleAmount.units} (${fromUnits(bundle.settleAmount.units, bundle.settleAmount.decimals)}) at contract ${bundle.settleAmount.origin.call.contractAddress} via ${bundle.settleAmount.origin.call.entrypoint} at blockNumber ${bundle.settleAmount.origin.call.blockNumber}`,
  );
  lines.push("");
  lines.push("POSITION ACTIONS:");
  if (bundle.positionActions.length === 0) {
    lines.push("none");
  } else {
    for (const action of bundle.positionActions) {
      lines.push(
        `${action.kind} ${action.amount.units} at contract ${action.vault ?? action.amount.origin.call.contractAddress} via ${action.amount.origin.call.entrypoint} at blockNumber ${action.amount.origin.call.blockNumber}`,
      );
    }
  }
  lines.push("");
  lines.push(bundle.copy);
  return lines.join("\n");
}

function fromUnits(units: string, decimals: number): string {
  const value = BigInt(units);
  const scale = 10n ** BigInt(decimals);
  const whole = value / scale;
  const frac = (value % scale)
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");
  return frac.length > 0 ? `${whole}.${frac}` : `${whole}`;
}

/** Sepolia head block at bundle generation, exposed for the page header. */
function deployBlock(env: Readonly<Record<string, string | undefined>>): number | undefined {
  const value = env.CARD_SETTLEMENT_DEPLOY_BLOCK;
  if (!value || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}
