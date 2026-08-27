//! JIT STRK -> USDC quote for the card's convert-and-pay leg.
//!
//! The pool withdraws STRK into the deployed JitConverter; that contract then
//! makes exactly one call on its pinned router with `swap_calldata[0]` as the
//! entrypoint selector and the remaining felts as ABI-ordered arguments, after
//! approving the router for `amount_in` (see contracts/src/jit_converter.cairo,
//! `run_swap`). The only Sepolia venue whose swap entrypoint matches that
//! approve-then-single-call shape is the AVNU Exchange: `multi_route_swap`
//! pulls the sold token with `transferFrom(caller)` and pays the bought token
//! to `beneficiary`, which the exchange requires to equal the caller - i.e.
//! the JitConverter itself, so its balance-delta `min_out` check holds.
//!
//! Liquidity itself lives on Ekubo Sepolia. AVNU's own Sepolia quote API
//! returns no routes for any pair (verified live 2026-08-27), so routing here
//! reads the Ekubo quoter API directly and translates its split routes into
//! AVNU `Route` structs for the AVNU Ekubo adapter. Everything below is pinned
//! against live reads made on 2026-08-27:
//!
//! - AVNU Exchange (Sepolia), the router JitConverter must be deployed with:
//!   0x02c56e8b00dbe2a71e57472685378fc8988bba947e9a99b26a00fade2b4fe7c2
//!   (`get_adapter_class_hash(EKUBO_CORE_SEPOLIA)` returned the non-zero class
//!   0x8afeda4ea37c8c497d65f5dc7ae9145d0d451af0449aef6d421cb7a0eb587f, whose
//!   Sierra program contains the Sepolia Ekubo router felt, not mainnet's.)
//! - Ekubo core (Sepolia), the `exchange_address` key of every route:
//!   0x0444a09d96389aa7148f1aada508e30b71299ffe650d9c97fdaae38cb9a23384
//! - Ekubo quoter: GET https://prod-api-quoter.ekubo.org/{decimal chain id}/
//!   {amount}/{sold}/{bought}; 2 STRK -> 1.190515 USDC at block 14129540.
//!
//! Fail-closed: any quoter error, empty route set, or invariant violation
//! throws `JitQuoteError`. Nothing here ever fabricates a route.

/** AVNU Exchange on Starknet Sepolia. Deploy JitConverter with this router. */
export const JIT_ROUTER_SEPOLIA =
  "0x02c56e8b00dbe2a71e57472685378fc8988bba947e9a99b26a00fade2b4fe7c2";

/** Ekubo core on Sepolia: the adapter-mapping key used as Route.exchange_address. */
export const EKUBO_CORE_SEPOLIA =
  "0x0444a09d96389aa7148f1aada508e30b71299ffe650d9c97fdaae38cb9a23384";

export const STRK_SEPOLIA =
  "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

export const USDC_SEPOLIA =
  "0x053b40a647cedfca6ca84f542a0fe36736031905a9639a7f19a3c1e66bfd5080";

/** starknet_keccak("multi_route_swap"); asserted against the library in tests. */
export const MULTI_ROUTE_SWAP_SELECTOR =
  "0x1171593aa5bdadda4d6b0efde6cc94ee7649c3163d5efeb19da6c16d63a2a63";

const EKUBO_QUOTER_BASE = "https://prod-api-quoter.ekubo.org";
/** SN_SEPOLIA chain id (0x534e5f5345504f4c4941) in the decimal form the quoter wants. */
const SN_SEPOLIA_CHAIN_ID = "393402133025997798000961";

/** AVNU route percent denominator: 10^12 is 100% (2 * 10^10 is 2%). */
export const MAX_ROUTE_PERCENT = 10n ** 12n;

/**
 * Passed as the adapter's `sqrt_ratio_distance`. The adapter clamps
 * `current +/- distance` to Ekubo's [MIN_SQRT_RATIO, MAX_SQRT_RATIO], so this
 * value (Ekubo's MAX_SQRT_RATIO) always degenerates to the full-range limit;
 * slippage is enforced by `buy_token_min_amount` and JitConverter's `min_out`
 * balance-delta check instead of a price limit.
 */
export const FULL_RANGE_SQRT_RATIO_DISTANCE =
  6277100250585753475930931601400621808602321654880405518632n;

/** AVNU fee (FeeOnBuy on Sepolia: both token weights are 0): read live via get_fees_bps_*. */
export const AVNU_FEE_BPS_SINGLE_ROUTE = 2n;
export const AVNU_FEE_BPS_MULTI_ROUTE = 10n;

export class JitQuoteError extends Error {
  constructor(
    message: string,
    readonly reason:
      | "network"
      | "no_liquidity"
      | "bad_quote"
      | "bad_input",
  ) {
    super(message);
    this.name = "JitQuoteError";
  }
}

export type EkuboPoolKey = {
  token0: string;
  token1: string;
  fee: string;
  tick_spacing: number;
  extension: string;
};

export type EkuboRouteNode = {
  pool_key: EkuboPoolKey;
  sqrt_ratio_limit: string;
  skip_ahead: number;
};

export type EkuboSplit = {
  amount_specified: string;
  amount_calculated: string;
  route: EkuboRouteNode[];
};

export type EkuboQuote = {
  block_number: number;
  total_calculated: string;
  splits: EkuboSplit[];
};

/** One AVNU `Route` struct (flat encoding, matching the deployed Sepolia ABI). */
export type AvnuRoute = {
  sellToken: string;
  buyToken: string;
  exchangeAddress: string;
  percent: bigint;
  additionalSwapParams: bigint[];
};

export type JitQuote = {
  /** The pinned router the calldata targets: AVNU Exchange on Sepolia. */
  router: string;
  soldToken: string;
  boughtToken: string;
  amountIn: bigint;
  /** Quoted output before AVNU fee and slippage; from the Ekubo quoter. */
  quotedOut: bigint;
  /** Floor enforced twice: multi_route_swap's min amount and JitConverter min_out. */
  minOut: bigint;
  /** Block the quote was pinned to; submit promptly. */
  blockNumber: number;
  /** `[selector, ...abi-ordered args]` exactly as JitConverter.run_swap expects. */
  swapCalldata: string[];
};

export function feltHex(value: bigint): string {
  if (value < 0n) throw new JitQuoteError(`negative felt: ${value}`, "bad_quote");
  return `0x${value.toString(16)}`;
}

function parseFelt(value: string, label: string): bigint {
  try {
    const v = BigInt(value);
    if (v < 0n) throw new Error("negative");
    return v;
  } catch {
    throw new JitQuoteError(`unparseable ${label}: ${value}`, "bad_quote");
  }
}

export function u256Parts(value: bigint): [bigint, bigint] {
  if (value < 0n) throw new JitQuoteError(`negative u256: ${value}`, "bad_quote");
  const mask = (1n << 128n) - 1n;
  return [value & mask, value >> 128n];
}

/**
 * The floor the swap must clear: quoted output, minus AVNU's on-buy fee,
 * minus the slippage allowance. Rounds down at each step; throws if the
 * result would be zero, because JitConverter rejects a zero `min_out`.
 */
export function computeMinOut(
  quotedOut: bigint,
  avnuFeeBps: bigint,
  slippageBps: bigint,
): bigint {
  if (quotedOut <= 0n) {
    throw new JitQuoteError("quoted output is zero", "no_liquidity");
  }
  if (slippageBps < 0n || slippageBps >= 10_000n) {
    throw new JitQuoteError(`slippageBps out of range: ${slippageBps}`, "bad_input");
  }
  const afterFee = (quotedOut * (10_000n - avnuFeeBps)) / 10_000n;
  const minOut = (afterFee * (10_000n - slippageBps)) / 10_000n;
  if (minOut <= 0n) {
    throw new JitQuoteError(
      `minOut collapsed to zero (quoted ${quotedOut})`,
      "no_liquidity",
    );
  }
  return minOut;
}

/**
 * Translates Ekubo quoter splits into sequential AVNU routes.
 *
 * AVNU applies routes in order; each consumes `percent / 10^12` of the
 * exchange's CURRENT balance of that route's sell token. So each split's
 * first hop takes its share of the remaining sold-token balance (the last
 * split sweeps 100% to satisfy the exchange's residual-token assert), and
 * every interior hop takes 100% of the intermediate it just received.
 *
 * That construction is only sound when no split's interior token is the sold
 * or bought token itself (a 100% interior hop would otherwise consume input
 * reserved for later splits, or re-sell already-bought output). Violations
 * throw rather than mis-route.
 */
export function buildAvnuRoutes(
  splits: EkuboSplit[],
  amountIn: bigint,
  soldToken: string,
  boughtToken: string,
): AvnuRoute[] {
  if (splits.length === 0) {
    throw new JitQuoteError("quoter returned no splits", "no_liquidity");
  }
  const sold = parseFelt(soldToken, "sold token");
  const bought = parseFelt(boughtToken, "bought token");

  const amounts = splits.map((s, i) => {
    const a = parseFelt(s.amount_specified, `split ${i} amount`);
    if (a <= 0n) {
      throw new JitQuoteError(`split ${i} has non-positive input`, "bad_quote");
    }
    return a;
  });
  const total = amounts.reduce((acc, a) => acc + a, 0n);
  if (total !== amountIn) {
    throw new JitQuoteError(
      `split inputs sum to ${total}, expected ${amountIn}`,
      "bad_quote",
    );
  }

  const routes: AvnuRoute[] = [];
  let remaining = amountIn;
  splits.forEach((split, splitIndex) => {
    if (split.route.length === 0) {
      throw new JitQuoteError(`split ${splitIndex} has no hops`, "bad_quote");
    }
    const isLastSplit = splitIndex === splits.length - 1;
    const firstHopPercent = isLastSplit
      ? MAX_ROUTE_PERCENT
      : (amounts[splitIndex] * MAX_ROUTE_PERCENT) / remaining;
    if (firstHopPercent <= 0n || firstHopPercent > MAX_ROUTE_PERCENT) {
      throw new JitQuoteError(
        `split ${splitIndex} percent out of range: ${firstHopPercent}`,
        "bad_quote",
      );
    }
    remaining -= amounts[splitIndex];

    let hopIn = sold;
    split.route.forEach((node, hopIndex) => {
      const token0 = parseFelt(node.pool_key.token0, "pool token0");
      const token1 = parseFelt(node.pool_key.token1, "pool token1");
      let hopOut: bigint;
      if (hopIn === token0) hopOut = token1;
      else if (hopIn === token1) hopOut = token0;
      else {
        throw new JitQuoteError(
          `split ${splitIndex} hop ${hopIndex}: input token not in pool`,
          "bad_quote",
        );
      }
      const isLastHop = hopIndex === split.route.length - 1;
      if (!isLastHop && (hopOut === sold || hopOut === bought)) {
        throw new JitQuoteError(
          `split ${splitIndex} routes through the sold/bought token; ` +
            "sequential percent translation would mis-route",
          "bad_quote",
        );
      }
      if (isLastHop && hopOut !== bought) {
        throw new JitQuoteError(
          `split ${splitIndex} ends on the wrong token`,
          "bad_quote",
        );
      }
      routes.push({
        sellToken: feltHex(hopIn),
        buyToken: feltHex(hopOut),
        exchangeAddress: EKUBO_CORE_SEPOLIA,
        percent: hopIndex === 0 ? firstHopPercent : MAX_ROUTE_PERCENT,
        additionalSwapParams: [
          token0,
          token1,
          parseFelt(node.pool_key.fee, "pool fee"),
          BigInt(node.pool_key.tick_spacing),
          parseFelt(node.pool_key.extension, "pool extension"),
          FULL_RANGE_SQRT_RATIO_DISTANCE,
        ],
      });
      hopIn = hopOut;
    });
  });
  return routes;
}

/**
 * Serializes `multi_route_swap` for JitConverter: element 0 is the selector,
 * the rest are the entrypoint's arguments in ABI order.
 */
export function encodeMultiRouteSwap(args: {
  sellToken: string;
  amountIn: bigint;
  buyToken: string;
  quotedOut: bigint;
  minOut: bigint;
  beneficiary: string;
  routes: AvnuRoute[];
}): string[] {
  if (args.routes.length === 0) {
    throw new JitQuoteError("cannot encode an empty route set", "bad_quote");
  }
  const beneficiary = parseFelt(args.beneficiary, "beneficiary");
  if (beneficiary === 0n) {
    throw new JitQuoteError("beneficiary must be non-zero", "bad_input");
  }
  const [inLow, inHigh] = u256Parts(args.amountIn);
  const [outLow, outHigh] = u256Parts(args.quotedOut);
  const [minLow, minHigh] = u256Parts(args.minOut);
  const calldata: bigint[] = [
    BigInt(MULTI_ROUTE_SWAP_SELECTOR),
    parseFelt(args.sellToken, "sell token"),
    inLow,
    inHigh,
    parseFelt(args.buyToken, "buy token"),
    outLow,
    outHigh,
    minLow,
    minHigh,
    beneficiary,
    0n, // integrator_fee_amount_bps
    0n, // integrator_fee_recipient
    BigInt(args.routes.length),
  ];
  for (const route of args.routes) {
    calldata.push(
      parseFelt(route.sellToken, "route sell token"),
      parseFelt(route.buyToken, "route buy token"),
      parseFelt(route.exchangeAddress, "route exchange"),
      route.percent,
      BigInt(route.additionalSwapParams.length),
      ...route.additionalSwapParams,
    );
  }
  return calldata.map(feltHex);
}

async function fetchEkuboQuote(
  amountIn: bigint,
  soldToken: string,
  boughtToken: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<EkuboQuote> {
  const url =
    `${EKUBO_QUOTER_BASE}/${SN_SEPOLIA_CHAIN_ID}/${amountIn}` +
    `/${soldToken}/${boughtToken}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetchImpl(url, { signal: controller.signal });
  } catch (error) {
    throw new JitQuoteError(
      `Ekubo quoter unreachable: ${error instanceof Error ? error.message : String(error)}`,
      "network",
    );
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new JitQuoteError(
      `Ekubo quoter returned ${response.status}: ${body.slice(0, 200)}`,
      response.status === 404 ? "no_liquidity" : "network",
    );
  }
  const quote = (await response.json()) as EkuboQuote;
  if (!Array.isArray(quote.splits) || quote.splits.length === 0) {
    throw new JitQuoteError(
      "Ekubo quoter found no route for the pair",
      "no_liquidity",
    );
  }
  return quote;
}

/**
 * Live STRK -> USDC quote plus ready-to-submit JitConverter swap calldata.
 *
 * `beneficiary` must be the deployed JitConverter address: the AVNU exchange
 * asserts `beneficiary == caller`, and the caller of `multi_route_swap` is the
 * JitConverter, whose balance-delta check then observes the payout.
 */
export async function getJitQuote(
  amountInStrk: bigint,
  beneficiary: string,
  options?: {
    slippageBps?: number;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
  },
): Promise<JitQuote> {
  if (amountInStrk <= 0n) {
    throw new JitQuoteError("amountInStrk must be positive", "bad_input");
  }
  if (parseFelt(beneficiary, "beneficiary") === 0n) {
    throw new JitQuoteError("beneficiary must be non-zero", "bad_input");
  }
  const slippageBps = BigInt(options?.slippageBps ?? 100);
  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? 10_000;

  const quote = await fetchEkuboQuote(
    amountInStrk,
    STRK_SEPOLIA,
    USDC_SEPOLIA,
    fetchImpl,
    timeoutMs,
  );
  const quotedOut = parseFelt(quote.total_calculated, "total_calculated");
  if (quotedOut <= 0n) {
    throw new JitQuoteError("Ekubo quoted zero output", "no_liquidity");
  }

  const routes = buildAvnuRoutes(
    quote.splits,
    amountInStrk,
    STRK_SEPOLIA,
    USDC_SEPOLIA,
  );
  const avnuFeeBps =
    routes.length > 1 ? AVNU_FEE_BPS_MULTI_ROUTE : AVNU_FEE_BPS_SINGLE_ROUTE;
  const minOut = computeMinOut(quotedOut, avnuFeeBps, slippageBps);

  const swapCalldata = encodeMultiRouteSwap({
    sellToken: STRK_SEPOLIA,
    amountIn: amountInStrk,
    buyToken: USDC_SEPOLIA,
    quotedOut,
    minOut,
    beneficiary,
    routes,
  });

  return {
    router: JIT_ROUTER_SEPOLIA,
    soldToken: STRK_SEPOLIA,
    boughtToken: USDC_SEPOLIA,
    amountIn: amountInStrk,
    quotedOut,
    minOut,
    blockNumber: quote.block_number,
    swapCalldata,
  };
}
