import { hash, RpcProvider } from "starknet";
import { authorizationIdFelt } from "./authorization.ts";
import { cardRuntimeStatus, parseCardRuntimeConfig } from "./runtime.ts";

const AUTHORIZATION_SETTLED_SELECTOR = hash.getSelectorFromName("AuthorizationSettled");
const POSITION_OPENED_SELECTOR = hash.getSelectorFromName("PositionOpened");
const PAYOUT_EXECUTED_SELECTOR = hash.getSelectorFromName("PayoutExecuted");
const EVENT_PAGE_SIZE = 100;
const MAX_EVENT_PAGES = 20;
const HEALTH_TIMEOUT_MS = 5_000;

/**
 * Settlement scanning budget.
 *
 * The settlement contracts were deployed at CARD_SETTLEMENT_DEPLOY_BLOCK and
 * Sepolia is now over a million blocks past it, so one open-ended
 * `from_block -> latest` getEvents made the node walk the whole gap on every
 * request. Measured against starknet-sepolia-rpc.publicnode.com: a single
 * open-ended range costs about 7s per contract, and the route ran six of them,
 * which is the 23s the page spent showing skeleton bars.
 *
 * Three changes, all of them narrowings rather than guesses:
 *  - both selectors for one contract go out as a single query, because the
 *    JSON-RPC key filter accepts a list of accepted values per key position;
 *  - the range is split into bounded windows issued concurrently, so no single
 *    request walks the whole gap;
 *  - what has already been walked is remembered per process, so the next
 *    request only scans the blocks produced since the last one.
 * Cold cost measured at 4.0s, warm cost at 0.2s.
 */
const EVENT_WINDOW_BLOCKS = 250_000;
const SCAN_CONCURRENCY = 18;
/**
 * Blocks re-read on every incremental scan. A block that was at the head when
 * it was indexed can still be reorganised out, so the tail is never trusted as
 * final; re-reading it and keying events by their own content makes the index
 * self-correcting instead of permanently wrong.
 */
const REORG_REWIND_BLOCKS = 128;
/** How long a completed scan is served before the chain is read again. */
const SETTLEMENTS_TTL_MS = 10_000;

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
    to_block: "latest" | { block_number: number };
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

type ScanTarget = { address: string; selectors: string[] };

type ScannedRange = { scannedTo: number; events: Map<string, ChainEvent> };

/** Per-process record of which blocks have already been walked, by RPC url. */
const scannedRanges = new Map<string, Map<string, ScannedRange>>();

/** Identity of an event, so a re-read window cannot duplicate what it finds. */
function eventKey(event: ChainEvent): string {
  return [
    event.transaction_hash,
    event.block_number ?? "",
    (event.keys || []).join(","),
    (event.data || []).join(","),
  ].join("|");
}

function sameFelt(left: string | undefined, right: string): boolean {
  if (!left) return false;
  try {
    return BigInt(left) === BigInt(right);
  } catch {
    return false;
  }
}

function blockWindows(from: number, to: number): Array<[number, number]> {
  const windows: Array<[number, number]> = [];
  for (let start = from; start <= to; start += EVENT_WINDOW_BLOCKS) {
    windows.push([start, Math.min(start + EVENT_WINDOW_BLOCKS - 1, to)]);
  }
  return windows;
}

async function runLimited<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<T[]> {
  const results = new Array<T>(tasks.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= tasks.length) return;
      results[index] = await tasks[index]();
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, worker),
  );
  return results;
}

async function pageEvents(
  provider: CardStatusProvider,
  address: string,
  selectors: string[],
  fromBlock: number,
  toBlock: number | "latest",
): Promise<ChainEvent[]> {
  const events: ChainEvent[] = [];
  let continuationToken: string | undefined;
  for (let page = 0; page < MAX_EVENT_PAGES; page += 1) {
    const result = await provider.getEvents({
      from_block: { block_number: fromBlock },
      to_block: toBlock === "latest" ? "latest" : { block_number: toBlock },
      address,
      keys: [selectors],
      chunk_size: EVENT_PAGE_SIZE,
      ...(continuationToken ? { continuation_token: continuationToken } : {}),
    });
    events.push(...result.events);
    if (!result.continuation_token) break;
    continuationToken = result.continuation_token;
  }
  return events;
}

async function readHeadBlock(
  provider: CardStatusProvider,
): Promise<number | undefined> {
  try {
    const head = await provider.getBlockNumber();
    return Number.isSafeInteger(head) && head > 0 ? head : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Every event the given targets have emitted since `fromBlock`, one array per
 * target, in the order the targets were given.
 *
 * With a head block the range is windowed and the walked part is remembered;
 * without one there is nothing to window against, so it falls back to a single
 * open-ended read per target.
 */
async function collectEvents(
  provider: CardStatusProvider,
  targets: ScanTarget[],
  fromBlock: number,
  head: number | undefined,
  index: Map<string, ScannedRange> | undefined,
): Promise<ChainEvent[][]> {
  if (head === undefined) {
    return Promise.all(
      targets.map((target) =>
        pageEvents(provider, target.address, target.selectors, fromBlock, "latest"),
      ),
    );
  }

  const plans = targets.map((target) => {
    const key = `${target.address}|${target.selectors.join(",")}`;
    const cached = index?.get(key);
    const start = cached
      ? Math.max(fromBlock, cached.scannedTo - REORG_REWIND_BLOCKS + 1)
      : fromBlock;
    return { target, key, cached, windows: blockWindows(start, head) };
  });

  const tasks: Array<() => Promise<{ at: number; events: ChainEvent[] }>> = [];
  plans.forEach((plan, at) => {
    for (const [from, to] of plan.windows) {
      tasks.push(async () => ({
        at,
        events: await pageEvents(
          provider,
          plan.target.address,
          plan.target.selectors,
          from,
          to,
        ),
      }));
    }
  });
  const scanned = await runLimited(tasks, SCAN_CONCURRENCY);

  return plans.map((plan, at) => {
    const merged = new Map(plan.cached?.events);
    for (const chunk of scanned) {
      if (chunk.at !== at) continue;
      for (const event of chunk.events) merged.set(eventKey(event), event);
    }
    index?.set(plan.key, { scannedTo: head, events: merged });
    return [...merged.values()];
  });
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

export type SettlementsSnapshot = {
  contractAddress: string;
  explorerContractUrl: string;
  settlements: SettledAuthorization[];
  /**
   * When this scan actually touched the chain, on the server clock. Optional
   * only so a test double can stand in for the scan; every real read sets it,
   * and the page says so explicitly when it is absent rather than falling back
   * to the browser clock, which would date a cached scan to when it was read.
   */
  readAtIso?: string;
  /** First block scanned, which is the settlement contract's deploy block. */
  fromBlock?: number;
  /** Last block scanned. Absent when the node did not report a head block. */
  headBlock?: number;
};

let snapshotCache:
  | { key: string; at: number; value: SettlementsSnapshot }
  | undefined;
let snapshotInflight:
  | { key: string; promise: Promise<SettlementsSnapshot> }
  | undefined;

async function scanSettledAuthorizations(
  env: Environment,
  provider: CardStatusProvider,
  index: Map<string, ScannedRange> | undefined,
): Promise<SettlementsSnapshot> {
  const contracts = settlementContracts(env);
  const programmable = env.CARD_PROGRAMMABLE_SPEND?.trim();
  const fromBlock = deployBlock(env) ?? 0;
  const head = await readHeadBlock(provider);

  const targets: ScanTarget[] = contracts.map((address) => ({
    address,
    selectors: [AUTHORIZATION_SETTLED_SELECTOR, POSITION_OPENED_SELECTOR],
  }));
  if (programmable) {
    targets.push({
      address: programmable,
      selectors: [PAYOUT_EXECUTED_SELECTOR, POSITION_OPENED_SELECTOR],
    });
  }

  const scanned = await collectEvents(provider, targets, fromBlock, head, index);
  const settlements: SettledAuthorization[] = [];

  contracts.forEach((_address, at) => {
    const events = scanned[at] || [];
    const settledEvents = events.filter((event) =>
      sameFelt(event.keys?.[0], AUTHORIZATION_SETTLED_SELECTOR),
    );
    const positions = new Map(
      events
        .filter((event) => sameFelt(event.keys?.[0], POSITION_OPENED_SELECTOR))
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
  });

  if (programmable) {
    const events = scanned[contracts.length] || [];
    const lendByTx = new Map<string, { vault: string; lendAssets: string }>();
    for (const event of events) {
      if (!sameFelt(event.keys?.[0], POSITION_OPENED_SELECTOR)) continue;
      const data = event.data || [];
      if (!event.transaction_hash || data.length < 4) continue;
      lendByTx.set(event.transaction_hash, {
        vault: data[0],
        lendAssets: uint256(data[2], data[3]).toString(),
      });
    }
    for (const event of events) {
      if (!sameFelt(event.keys?.[0], PAYOUT_EXECUTED_SELECTOR)) continue;
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
    readAtIso: new Date().toISOString(),
    fromBlock,
    ...(head === undefined ? {} : { headBlock: head }),
  };
}

export async function listSettledAuthorizations(
  options: Omit<StatusOptions, "fetcher"> = {},
): Promise<SettlementsSnapshot> {
  const env = options.env || process.env;
  const contracts = settlementContracts(env);
  if (contracts.length === 0) {
    throw new Error("CARD_SETTLEMENT_CONTRACT missing");
  }
  const config = publicRuntimeConfig(env);

  // A caller that brought its own provider gets an uncached read against it.
  // The index and the snapshot are both keyed to the default RPC endpoint, and
  // handing an injected provider a range someone else already walked would
  // report blocks that provider never saw.
  if (options.provider) {
    return scanSettledAuthorizations(env, options.provider, undefined);
  }

  const key = [
    config.rpcUrl,
    contracts.join(","),
    env.CARD_PROGRAMMABLE_SPEND?.trim() || "",
  ].join("|");
  const cached = snapshotCache;
  if (cached?.key === key && Date.now() - cached.at < SETTLEMENTS_TTL_MS) {
    return cached.value;
  }
  if (snapshotInflight?.key === key) return snapshotInflight.promise;

  let index = scannedRanges.get(key);
  if (!index) {
    index = new Map<string, ScannedRange>();
    scannedRanges.set(key, index);
  }

  const pending = scanSettledAuthorizations(
    env,
    providerFor(config.rpcUrl),
    index,
  )
    .then((value) => {
      snapshotCache = { key, at: Date.now(), value };
      return value;
    })
    .finally(() => {
      if (snapshotInflight?.key === key) snapshotInflight = undefined;
    });
  snapshotInflight = { key, promise: pending };
  return pending;
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
