//! JIT card settlement: withdraw STRK from the shielded pool straight to the
//! deployed JitConverter, then run `convert_and_pay` as an ordinary second
//! top-level call in the SAME `account.execute` batch.
//!
//! Per contracts/src/jit_converter.cairo's header, the pool only limits
//! privacy *opcodes* (at most one Invoke action inside the proven pool
//! bundle), not the number of top-level calls in the transaction. So this
//! module builds a pool bundle with NO `.invoke(...)` at all - a plain
//! `withdraw` to the JitConverter address is enough - and appends the
//! JitConverter call as call #2. One signature, one privacy invoke, one fee.
//!
//! Kept separate from runtime.ts (per the task's instruction not to touch
//! that file): shared pieces (`parseCardRuntimeConfig`, `cardRuntimeStatus`,
//! `deriveHostedViewingKey`, `ensurePoolFeeAllowance`, `isTerminalFinality`)
//! are imported from it; the small pieces it does not export
//! (`waitForTerminalReceipt`, a u256 contract reader) are duplicated here
//! rather than editing runtime.ts.

import { Account, RpcProvider, constants, type Call } from "starknet";
import {
  IndexerDiscoveryProvider,
  createPrivateTransfers,
} from "@starkware-libs/starknet-privacy-sdk";
import { authorizationIdFelt } from "./authorization.ts";
import {
  cardRuntimeStatus,
  deriveHostedViewingKey,
  ensurePoolFeeAllowance,
  isTerminalFinality,
  parseCardRuntimeConfig,
} from "./runtime.ts";
import { feltHex, getJitQuote, u256Parts, type JitQuote } from "./jit.ts";

type Environment = Readonly<Record<string, string | undefined>>;

const DEFAULT_RPC_URL = "https://starknet-sepolia-rpc.publicnode.com";

export class JitSettlementConfigError extends Error {
  readonly name = "JitSettlementConfigError";
}

/** Resolves CARD_JIT_CONVERTER; undefined (never throws) when unset. */
export function jitConverterAddress(env: Environment = process.env): string | undefined {
  const value = env.CARD_JIT_CONVERTER?.trim();
  return value || undefined;
}

export type JitSettlementReadiness = {
  ready: boolean;
  missing: string[];
  network: "sepolia";
  jitConverter?: string;
};

/** Base readiness: the card runtime env plus CARD_JIT_CONVERTER. No network calls. */
export function jitSettlementReadiness(
  env: Environment = process.env,
): JitSettlementReadiness {
  const runtime = cardRuntimeStatus(env);
  const jitConverter = jitConverterAddress(env);
  const missing = [...runtime.missing];
  if (!jitConverter) missing.push("CARD_JIT_CONVERTER");
  return {
    ready: runtime.ready && Boolean(jitConverter),
    missing,
    network: "sepolia",
    jitConverter,
  };
}

export type JitConfigRead = {
  owner: string;
  router: string;
  recipient: string;
};

/** Live `get_config` read off the deployed JitConverter. Throws on a malformed response. */
export async function readJitConfig(
  env: Environment = process.env,
  provider?: RpcProvider,
): Promise<JitConfigRead | undefined> {
  const jitConverter = jitConverterAddress(env);
  if (!jitConverter) return undefined;
  const rpcUrl = env.CARD_RUNTIME_RPC_URL || env.TESTNET_RPC || DEFAULT_RPC_URL;
  const rpc = provider || new RpcProvider({ nodeUrl: rpcUrl });
  const result = await rpc.callContract({
    contractAddress: jitConverter,
    entrypoint: "get_config",
    calldata: [],
  });
  if (result.length < 3) {
    throw new Error("Malformed JitConverter get_config response.");
  }
  return { owner: result[0], router: result[1], recipient: result[2] };
}

export type JitRouteReadiness = JitSettlementReadiness & {
  config?: JitConfigRead;
  configError?: "contract_read_failed";
};

/** GET-route readiness: env presence plus a live `get_config` read (best-effort). */
export async function jitReadinessWithConfig(
  env: Environment = process.env,
): Promise<JitRouteReadiness> {
  const base = jitSettlementReadiness(env);
  if (!base.jitConverter) return base;
  try {
    const config = await readJitConfig(env);
    return { ...base, config };
  } catch {
    return { ...base, ready: false, configError: "contract_read_failed" };
  }
}

/**
 * Serializes `convert_and_pay`'s calldata in exact ABI order:
 * `authorization_id, sold_token, bought_token, amount_in (u256), min_out
 * (u256), swap_calldata (Span<felt252>)`. Cairo's Serde for `Span<felt252>`
 * is a length prefix followed by the elements - `swap_calldata.length` then
 * `...swap_calldata` - matching `contracts/src/jit_converter.cairo`'s
 * `convert_and_pay` signature exactly.
 */
export function buildConvertAndPayCalldata(args: {
  authorizationId: bigint;
  soldToken: string;
  boughtToken: string;
  amountIn: bigint;
  minOut: bigint;
  swapCalldata: string[];
}): (string | bigint)[] {
  if (args.authorizationId <= 0n) {
    throw new JitSettlementConfigError("authorizationId must be positive.");
  }
  if (args.amountIn <= 0n) {
    throw new JitSettlementConfigError("amountIn must be positive.");
  }
  if (args.minOut <= 0n) {
    throw new JitSettlementConfigError("minOut must be positive.");
  }
  if (args.swapCalldata.length === 0) {
    throw new JitSettlementConfigError("swapCalldata must not be empty.");
  }
  const [inLow, inHigh] = u256Parts(args.amountIn);
  const [minLow, minHigh] = u256Parts(args.minOut);
  return [
    args.authorizationId,
    args.soldToken,
    args.boughtToken,
    inLow,
    inHigh,
    minLow,
    minHigh,
    BigInt(args.swapCalldata.length),
    ...args.swapCalldata,
  ];
}

export type DeriveAmountOptions = {
  probeStrk?: bigint;
  slippageBps?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  maxIterations?: number;
  /** Extra headroom above the linear estimate, in bps (default 500 = +5%). */
  safetyBps?: number;
};

/**
 * Derives the STRK input needed so the quoted `minOut` clears
 * `targetUsdcAtomic` (6-decimal USDC units). Quotes are not exactly linear
 * (fees, slippage, route shape), so this probes once to estimate the rate,
 * then re-quotes at the estimate and rescales toward the target until
 * `minOut` clears it or `maxIterations` is exhausted.
 */
export async function deriveAmountInStrk(
  targetUsdcAtomic: bigint,
  beneficiary: string,
  options?: DeriveAmountOptions,
): Promise<{ amountInStrk: bigint; quote: JitQuote }> {
  if (targetUsdcAtomic <= 0n) {
    throw new JitSettlementConfigError("targetUsdcAtomic must be positive.");
  }
  const probeStrk = options?.probeStrk ?? 10n ** 18n;
  const safetyBps = BigInt(options?.safetyBps ?? 500);
  const maxIterations = options?.maxIterations ?? 4;
  const quoteOptions = {
    slippageBps: options?.slippageBps,
    timeoutMs: options?.timeoutMs,
    fetchImpl: options?.fetchImpl,
  };

  const probeQuote = await getJitQuote(probeStrk, beneficiary, quoteOptions);
  if (probeQuote.quotedOut <= 0n) {
    throw new JitSettlementConfigError("Probe quote returned zero output.");
  }

  let amountInStrk =
    (targetUsdcAtomic * probeStrk * (10_000n + safetyBps)) /
    (probeQuote.quotedOut * 10_000n);
  if (amountInStrk <= 0n) amountInStrk = probeStrk;

  let quote = probeQuote;
  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    quote = await getJitQuote(amountInStrk, beneficiary, quoteOptions);
    if (quote.minOut >= targetUsdcAtomic) {
      return { amountInStrk, quote };
    }
    amountInStrk =
      (amountInStrk * targetUsdcAtomic * (10_000n + safetyBps)) /
      (quote.minOut * 10_000n);
  }
  throw new JitSettlementConfigError(
    `Could not derive an amountInStrk covering ${targetUsdcAtomic} USDC atomic units ` +
      `within ${maxIterations} iterations (last minOut ${quote.minOut}).`,
  );
}

export type JitSettlementRequest = {
  /** Any stable id; hashed the same way as CardSettlement authorizations. */
  authorizationId: string;
  /** Explicit STRK input (18-decimal units). Takes priority over amountUsdMinor. */
  amountInStrk?: bigint;
  /** Target USD amount in minor units (cents); derives amountInStrk via a quote. */
  amountUsdMinor?: number;
  slippageBps?: number;
};

export type JitSettlementResult = {
  authorizationId: string;
  authorizationFelt: string;
  transactionHash: string;
  finalityStatus: string;
  executionStatus: string;
  blockNumber?: number;
  amountInStrk: string;
  quotedOut: string;
  minOut: string;
  paid: string;
  jitConverter: string;
  router: string;
  soldToken: string;
  boughtToken: string;
  warnings: string[];
};

async function readU256(
  provider: RpcProvider,
  contractAddress: string,
  entrypoint: string,
  calldata: (string | bigint)[],
): Promise<bigint> {
  const result = await provider.callContract({
    contractAddress,
    entrypoint,
    calldata: calldata.map((value) => (typeof value === "bigint" ? feltHex(value) : value)),
  });
  return BigInt(result[0] || "0") + (BigInt(result[1] || "0") << 128n);
}

async function readBool(
  provider: RpcProvider,
  contractAddress: string,
  entrypoint: string,
  calldata: (string | bigint)[],
): Promise<boolean> {
  const result = await provider.callContract({
    contractAddress,
    entrypoint,
    calldata: calldata.map((value) => (typeof value === "bigint" ? feltHex(value) : value)),
  });
  return BigInt(result[0] || "0") !== 0n;
}

async function waitForTerminalReceipt(
  provider: RpcProvider,
  transactionHash: string,
  timeoutMs = 240_000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const receipt = await provider.getTransactionReceipt(transactionHash);
      const finality =
        "finality_status" in receipt ? String(receipt.finality_status) : "";
      if (isTerminalFinality(finality)) return receipt;
    } catch {
      // The tx can take a few blocks to surface at the selected RPC.
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(`Timed out waiting for ${transactionHash}`);
}

/**
 * Executes one live JIT settlement: withdraw `amountInStrk` STRK from the
 * hosted pool position straight to CARD_JIT_CONVERTER (no privacy_invoke),
 * then call `convert_and_pay` as call #2 in the same `account.execute`
 * batch, owner-gated to the hosted account.
 */
export async function executeJitCardSettlement(
  request: JitSettlementRequest,
  env: Environment = process.env,
): Promise<JitSettlementResult> {
  if (!request.authorizationId) {
    throw new JitSettlementConfigError("authorizationId is required.");
  }
  const config = parseCardRuntimeConfig(env);
  const jitConverter = jitConverterAddress(env);
  if (!jitConverter) {
    throw new JitSettlementConfigError("CARD_JIT_CONVERTER is not set.");
  }
  const authorizationId = authorizationIdFelt(request.authorizationId);

  const provider = new RpcProvider({ nodeUrl: config.rpcUrl });
  const account = new Account({
    provider,
    address: config.accountAddress,
    signer: config.privateKey,
    cairoVersion: "1",
  });

  // Fail closed: never re-spend an authorization id the converter already
  // settled (mirrors its own on-chain replay guard, checked before we build
  // a private bundle and burn a proof on a doomed submission).
  const alreadyUsed = await readBool(provider, jitConverter, "is_authorization_used", [
    authorizationId,
  ]);
  if (alreadyUsed) {
    throw new JitSettlementConfigError(
      `Authorization ${request.authorizationId} was already settled by the JIT converter.`,
    );
  }

  await ensurePoolFeeAllowance({
    provider,
    account,
    accountAddress: config.accountAddress,
    poolAddress: config.poolAddress,
  });

  let amountInStrk: bigint;
  let quote: JitQuote;
  if (request.amountInStrk !== undefined) {
    if (request.amountInStrk <= 0n) {
      throw new JitSettlementConfigError("amountInStrk must be positive.");
    }
    amountInStrk = request.amountInStrk;
    quote = await getJitQuote(amountInStrk, jitConverter, {
      slippageBps: request.slippageBps,
    });
  } else if (request.amountUsdMinor !== undefined) {
    if (!Number.isSafeInteger(request.amountUsdMinor) || request.amountUsdMinor <= 0) {
      throw new JitSettlementConfigError("amountUsdMinor must be a positive integer.");
    }
    const targetUsdcAtomic = BigInt(request.amountUsdMinor) * 10_000n;
    const derived = await deriveAmountInStrk(targetUsdcAtomic, jitConverter, {
      slippageBps: request.slippageBps,
    });
    amountInStrk = derived.amountInStrk;
    quote = derived.quote;
  } else {
    throw new JitSettlementConfigError("Provide amountInStrk or amountUsdMinor.");
  }

  const viewingKey = deriveHostedViewingKey(
    config.privateKey,
    constants.StarknetChainId.SN_SEPOLIA,
    config.poolAddress,
  );
  const transfers = createPrivateTransfers({
    account,
    viewingKeyProvider: { getViewingKey: async () => viewingKey },
    provingProvider: {
      url: config.provingUrl,
      chainId: constants.StarknetChainId.SN_SEPOLIA,
      nodeUrl: config.rpcUrl,
    },
    discoveryProvider: new IndexerDiscoveryProvider(
      config.indexerUrl,
      config.poolAddress,
    ),
    poolContractAddress: config.poolAddress,
  });

  const head = await provider.getBlockNumber();
  // Deliberately no `.invoke(...)`: the pool bundle is a plain withdraw to
  // the JitConverter. That is call #1; convert_and_pay rides along as call #2
  // in the same account.execute batch below.
  const { callAndProof, warnings } = await transfers
    .build({
      autoSetup: true,
      autoDiscover: { notes: "refresh", channels: "refresh" },
      autoSelectNotes: "all",
      provingBlockId: Math.max(0, head - 10),
    })
    .with(config.settlementToken, (token) =>
      token
        .withdraw({ recipient: jitConverter, amount: amountInStrk })
        .surplusTo(config.accountAddress, false),
    )
    .execute();

  const convertCall: Call = {
    contractAddress: jitConverter,
    entrypoint: "convert_and_pay",
    calldata: buildConvertAndPayCalldata({
      authorizationId,
      soldToken: quote.soldToken,
      boughtToken: quote.boughtToken,
      amountIn: quote.amountIn,
      minOut: quote.minOut,
      swapCalldata: quote.swapCalldata,
    }),
  };

  const proofDetails = callAndProof.proof.proofFacts.length
    ? { proofFacts: callAndProof.proof.proofFacts, proof: callAndProof.proof.data }
    : {};
  const submitted = await account.execute([callAndProof.call, convertCall], {
    tip: 0n,
    ...proofDetails,
  });
  const receipt = await waitForTerminalReceipt(provider, submitted.transaction_hash);
  if (!receipt.isSuccess()) {
    throw new Error(`JIT settlement failed: ${submitted.transaction_hash}`);
  }

  const paid = await readU256(provider, jitConverter, "paid_for", [authorizationId]);

  return {
    authorizationId: request.authorizationId,
    authorizationFelt: feltHex(authorizationId),
    transactionHash: submitted.transaction_hash,
    finalityStatus: String(receipt.finality_status),
    executionStatus: String(receipt.execution_status),
    blockNumber: "block_number" in receipt ? Number(receipt.block_number) : undefined,
    amountInStrk: amountInStrk.toString(),
    quotedOut: quote.quotedOut.toString(),
    minOut: quote.minOut.toString(),
    paid: paid.toString(),
    jitConverter,
    router: quote.router,
    soldToken: quote.soldToken,
    boughtToken: quote.boughtToken,
    warnings: warnings.map((warning) => String(warning.code)),
  };
}
