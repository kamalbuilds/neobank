import { hash, RpcProvider } from "starknet";
import { authorizationIdFelt } from "./authorization.ts";
import { cardRuntimeStatus, parseCardRuntimeConfig } from "./runtime.ts";

const AUTHORIZATION_SETTLED_SELECTOR = hash.getSelectorFromName("AuthorizationSettled");
const POSITION_OPENED_SELECTOR = hash.getSelectorFromName("PositionOpened");
const PAYOUT_EXECUTED_SELECTOR = hash.getSelectorFromName("PayoutExecuted");
const EVENT_PAGE_SIZE = 100;
const MAX_EVENT_PAGES = 20;
const HEALTH_TIMEOUT_MS = 5_000;

type Environment = Readonly<Record<string, string | undefined>>;

type ChainEvent = {
  transaction_hash: string;
  keys?: string[];
  data?: string[];
  block_number?: number;
};

type EventPage = {
  events: ChainEvent[];
  continuation_token?: string;
};

export type CardStatusProvider = {
  getBlockNumber(): Promise<number>;
  callContract(call: {
    contractAddress: string;
    entrypoint: string;
    calldata: string[];
  }): Promise<string[]>;
  getEvents(filter: {
    from_block: { block_number: number };
    to_block: "latest";
    address: string;
    keys: string[][];
    chunk_size: number;
    continuation_token?: string;
  }): Promise<EventPage>;
};

type Fetcher = (
  input: string,
  init?: RequestInit,
) => Promise<{ ok: boolean; status: number }>;

type StatusOptions = {
  env?: Environment;
  provider?: CardStatusProvider;
  fetcher?: Fetcher;
};

type ServiceHealth =
  | { ok: true; status: number }
  | { ok: false; status?: number; error: "unreachable" };

type RpcHealth =
  | { ok: true; blockNumber: number }
  | { ok: false; error: "unreachable" };

type CardSettlementHealth =
  | {
      ok: true;
      contractAddress: string;
      config: {
        owner: string;
        privacyPool: string;
        settlementRecipient: string;
        settlementToken: string;
        maxPerTransaction: string;
        dailyLimit: string;
        frozen: boolean;
      };
      dailySpend: { day: number; amount: string };
    }
  | {
      ok: false;
      contractAddress: string;
      error: "contract_read_failed";
    };

export type CardRuntimeHealth = {
  configured: boolean;
  ready: boolean;
  missing: string[];
  network: "sepolia";
  accountAddress?: string;
  poolAddress: string;
  demoAuthorize: boolean;
  health: {
    rpc: RpcHealth;
    proving: ServiceHealth;
    indexer: ServiceHealth;
    cardSettlement?: CardSettlementHealth;
  };
};

export type AuthorizationStatus = {
  authorizationId: string;
  authorizationFelt: string;
  settled: boolean;
  contractAddress: string;
  explorerContractUrl: string;
  transactionHash?: string;
  explorerTransactionUrl?: string;
};

export type SettledAuthorization = {
  authorizationFelt: string;
  transactionHash: string;
  explorerTransactionUrl: string;
  recipient: string;
  token: string;
  amount: string;
  day: number;
  blockNumber?: number;
  lendAssets?: string;
  lendShares?: string;
  vault?: string;
};

export function validateAuthorizationId(authorizationId: string): boolean {
  return /^[\x20-\x7e]{1,128}$/.test(authorizationId);
}

function hex(value: bigint): string {
  return `0x${value.toString(16)}`;
}

function uint256(low: string, high: string): bigint {
  return BigInt(low) + (BigInt(high) << 128n);
}

// Reuse runtime.ts as the source of public endpoint defaults without exposing
// or requiring private values for read-only health checks.
function publicRuntimeConfig(env: Environment) {
  return parseCardRuntimeConfig({
    ...env,
    CARD_RUNTIME_ACCOUNT_ADDRESS: env.CARD_RUNTIME_ACCOUNT_ADDRESS || "0x1",
    CARD_RUNTIME_PRIVATE_KEY: env.CARD_RUNTIME_PRIVATE_KEY || "0x1",
    CARD_SETTLEMENT_CONTRACT: env.CARD_SETTLEMENT_CONTRACT || "0x1",
    CARD_SETTLEMENT_TOKEN: env.CARD_SETTLEMENT_TOKEN || "0x1",
    CARD_SETTLEMENT_UNITS_PER_USD: "1",
    CARD_WEBHOOK_SECRET: env.CARD_WEBHOOK_SECRET || "unused",
  });
}

function providerFor(rpcUrl: string): CardStatusProvider {
  return new RpcProvider({ nodeUrl: rpcUrl }) as unknown as CardStatusProvider;
}

async function checkRpc(provider: CardStatusProvider): Promise<RpcHealth> {
  try {
    return { ok: true, blockNumber: await provider.getBlockNumber() };
  } catch {
    return { ok: false, error: "unreachable" };
  }
}

async function checkService(url: string, fetcher: Fetcher): Promise<ServiceHealth> {
  try {
    const response = await fetcher(`${url.replace(/\/+$/, "")}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    return response.ok
      ? { ok: true, status: response.status }
      : { ok: false, status: response.status, error: "unreachable" };
  } catch {
    return { ok: false, error: "unreachable" };
  }
}

async function checkCardSettlement(
  provider: CardStatusProvider,
  contractAddress: string,
): Promise<CardSettlementHealth> {
  try {
    const [config, dailySpend] = await Promise.all([
      provider.callContract({
        contractAddress,
        entrypoint: "get_config",
        calldata: [],
      }),
      provider.callContract({
        contractAddress,
        entrypoint: "get_daily_spend",
        calldata: [],
      }),
    ]);
    if (config.length < 9 || dailySpend.length < 3) {
      throw new Error("Malformed contract response.");
    }

    return {
      ok: true,
      contractAddress,
      config: {
        owner: config[0],
        privacyPool: config[1],
        settlementRecipient: config[2],
        settlementToken: config[3],
        maxPerTransaction: uint256(config[4], config[5]).toString(),
        dailyLimit: uint256(config[6], config[7]).toString(),
        frozen: BigInt(config[8]) !== 0n,
      },
      dailySpend: {
        day: Number(BigInt(dailySpend[0])),
        amount: uint256(dailySpend[1], dailySpend[2]).toString(),
      },
    };
  } catch {
    return { ok: false, contractAddress, error: "contract_read_failed" };
  }
}

export async function readCardRuntimeHealth(
  options: StatusOptions = {},
): Promise<CardRuntimeHealth> {
  const env = options.env || process.env;
  const runtime = cardRuntimeStatus(env);
  const config = publicRuntimeConfig(env);
  const provider = options.provider || providerFor(config.rpcUrl);
  const fetcher = options.fetcher || fetch;
  let configured = runtime.ready;
  if (configured) {
    try {
      parseCardRuntimeConfig(env);
    } catch {
      configured = false;
    }
  }

  const [rpc, proving, indexer, cardSettlement] = await Promise.all([
    checkRpc(provider),
    checkService(config.provingUrl, fetcher),
    checkService(config.indexerUrl, fetcher),
    env.CARD_SETTLEMENT_CONTRACT
      ? checkCardSettlement(provider, env.CARD_SETTLEMENT_CONTRACT)
      : Promise.resolve(undefined),
  ]);
  const healthy =
    rpc.ok &&
    proving.ok &&
    indexer.ok &&
    (!cardSettlement || cardSettlement.ok);

  return {
    configured,
    ready: configured && healthy,
    missing: runtime.missing,
    network: runtime.network,
    accountAddress: runtime.accountAddress,
    poolAddress: runtime.poolAddress,
    demoAuthorize: env.CARD_DEMO_AUTHORIZE === "1",
    health: { rpc, proving, indexer, cardSettlement },
  };
}

function deployBlock(env: Environment): number | undefined {
  const value = env.CARD_SETTLEMENT_DEPLOY_BLOCK;
  if (!value || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

async function findSettlementTransaction(
  provider: CardStatusProvider,
  contractAddress: string,
  authorizationFelt: string,
  fromBlock: number,
): Promise<string | undefined> {
  let continuationToken: string | undefined;
  for (let page = 0; page < MAX_EVENT_PAGES; page += 1) {
    const result = await provider.getEvents({
      from_block: { block_number: fromBlock },
      to_block: "latest",
      address: contractAddress,
      keys: [[AUTHORIZATION_SETTLED_SELECTOR], [authorizationFelt]],
      chunk_size: EVENT_PAGE_SIZE,
      ...(continuationToken ? { continuation_token: continuationToken } : {}),
    });
    if (result.events[0]) return result.events[0].transaction_hash;
    if (!result.continuation_token) return undefined;
    continuationToken = result.continuation_token;
  }
  return undefined;
}

function settlementContract(env: Environment): string {
  const value =
    env.CARD_PROGRAM_CONTRACT?.trim() || env.CARD_SETTLEMENT_CONTRACT?.trim();
  if (!value) {
    throw new Error("CARD_SETTLEMENT_CONTRACT missing");
  }
  return value;
}

function settlementContracts(env: Environment): string[] {
  const values = [
    env.CARD_PROGRAM_CONTRACT?.trim(),
    env.CARD_SETTLEMENT_CONTRACT?.trim(),
  ].filter((value): value is string => Boolean(value));
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    const key = BigInt(value).toString();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(value);
  }
  return unique;
}

function parseSettledEvent(
  event: ChainEvent,
): SettledAuthorization | undefined {
  const authorizationFelt = event.keys?.[1];
  const data = event.data || [];
  if (!event.transaction_hash || !authorizationFelt || data.length < 5) {
    return undefined;
  }
  return {
    authorizationFelt,
    transactionHash: event.transaction_hash,
    explorerTransactionUrl: `https://sepolia.voyager.online/tx/${event.transaction_hash}`,
    recipient: data[0],
    token: data[1],
    amount: uint256(data[2], data[3]).toString(),
    day: Number(BigInt(data[4])),
    blockNumber: event.block_number,
  };
}

async function collectEvents(
  provider: CardStatusProvider,
  contractAddress: string,
  selector: string,
  fromBlock: number,
): Promise<ChainEvent[]> {
  const events: ChainEvent[] = [];
  let continuationToken: string | undefined;
  for (let page = 0; page < MAX_EVENT_PAGES; page += 1) {
    const result = await provider.getEvents({
      from_block: { block_number: fromBlock },
      to_block: "latest",
      address: contractAddress,
      keys: [[selector]],
      chunk_size: EVENT_PAGE_SIZE,
      ...(continuationToken ? { continuation_token: continuationToken } : {}),
    });
    events.push(...result.events);
    if (!result.continuation_token) break;
    continuationToken = result.continuation_token;
  }
  return events;
}

function parsePositionOpened(
  event: ChainEvent,
): { authorizationFelt: string; vault: string; lendAssets: string; lendShares: string } | undefined {
  const authorizationFelt = event.keys?.[1];
  const data = event.data || [];
  if (!authorizationFelt || data.length < 5) return undefined;
  return {
    authorizationFelt,
    vault: data[0],
    lendAssets: uint256(data[1], data[2]).toString(),
    lendShares: uint256(data[3], data[4]).toString(),
  };
}

export async function listSettledAuthorizations(
  options: Omit<StatusOptions, "fetcher"> = {},
): Promise<{
  contractAddress: string;
  explorerContractUrl: string;
  settlements: SettledAuthorization[];
}> {
  const env = options.env || process.env;
  const contracts = settlementContracts(env);
  if (contracts.length === 0) {
    throw new Error("CARD_SETTLEMENT_CONTRACT missing");
  }
  const config = publicRuntimeConfig(env);
  const provider = options.provider || providerFor(config.rpcUrl);
  const fromBlock = deployBlock(env) ?? 0;
  const settlements: SettledAuthorization[] = [];

  for (const contractAddress of contracts) {
    const [settledEvents, positionEvents] = await Promise.all([
      collectEvents(provider, contractAddress, AUTHORIZATION_SETTLED_SELECTOR, fromBlock),
      collectEvents(provider, contractAddress, POSITION_OPENED_SELECTOR, fromBlock),
    ]);
    const positions = new Map(
      positionEvents
        .map(parsePositionOpened)
        .filter(
          (
            value,
          ): value is {
            authorizationFelt: string;
            vault: string;
            lendAssets: string;
            lendShares: string;
          } => Boolean(value),
        )
        .map((value) => [value.authorizationFelt, value]),
    );
    for (const event of settledEvents) {
      const parsed = parseSettledEvent(event);
      if (!parsed) continue;
      const position = positions.get(parsed.authorizationFelt);
      settlements.push(
        position
          ? {
              ...parsed,
              vault: position.vault,
              lendAssets: position.lendAssets,
              lendShares: position.lendShares,
            }
          : parsed,
      );
    }
  }

  const programmable = env.CARD_PROGRAMMABLE_SPEND?.trim();
  if (programmable) {
    const [payouts, positions] = await Promise.all([
      collectEvents(provider, programmable, PAYOUT_EXECUTED_SELECTOR, fromBlock),
      collectEvents(provider, programmable, POSITION_OPENED_SELECTOR, fromBlock),
    ]);
    const lendByTx = new Map<string, { vault: string; lendAssets: string }>();
    for (const event of positions) {
      const data = event.data || [];
      if (!event.transaction_hash || data.length < 4) continue;
      lendByTx.set(event.transaction_hash, {
        vault: data[0],
        lendAssets: uint256(data[2], data[3]).toString(),
      });
    }
    for (const event of payouts) {
      const data = event.data || [];
      if (!event.transaction_hash || data.length < 4) continue;
      const lend = lendByTx.get(event.transaction_hash);
      settlements.push({
        authorizationFelt: event.transaction_hash,
        transactionHash: event.transaction_hash,
        explorerTransactionUrl: `https://sepolia.voyager.online/tx/${event.transaction_hash}`,
        recipient: data[0],
        token: data[1],
        amount: uint256(data[2], data[3]).toString(),
        day: 0,
        blockNumber: event.block_number,
        vault: lend?.vault,
        lendAssets: lend?.lendAssets,
      });
    }
  }

  settlements.sort((a, b) => (b.blockNumber || 0) - (a.blockNumber || 0));
  const contractAddress = settlementContract(env);
  return {
    contractAddress,
    explorerContractUrl: `https://sepolia.voyager.online/contract/${contractAddress}`,
    settlements,
  };
}

export async function readAuthorizationStatus(
  authorizationId: string,
  options: Omit<StatusOptions, "fetcher"> = {},
): Promise<AuthorizationStatus> {
  if (!validateAuthorizationId(authorizationId)) {
    throw new TypeError("Invalid authorization id.");
  }

  const env = options.env || process.env;
  const contractAddress = settlementContract(env);
  const config = publicRuntimeConfig(env);
  const provider = options.provider || providerFor(config.rpcUrl);
  const authorizationFelt = hex(authorizationIdFelt(authorizationId));
  const used = await provider.callContract({
    contractAddress,
    entrypoint: "is_authorization_used",
    calldata: [authorizationFelt],
  });
  const settled = BigInt(used[0] || "0x0") !== 0n;
  const result: AuthorizationStatus = {
    authorizationId,
    authorizationFelt,
    settled,
    contractAddress,
    explorerContractUrl: `https://sepolia.voyager.online/contract/${contractAddress}`,
  };

  const fromBlock = deployBlock(env);
  if (!settled || fromBlock === undefined) return result;

  let transactionHash: string | undefined;
  try {
    transactionHash = await findSettlementTransaction(
      provider,
      contractAddress,
      authorizationFelt,
      fromBlock,
    );
  } catch {
    return result;
  }
  return transactionHash
    ? {
        ...result,
        transactionHash,
        explorerTransactionUrl: `https://sepolia.voyager.online/tx/${transactionHash}`,
      }
    : result;
}
