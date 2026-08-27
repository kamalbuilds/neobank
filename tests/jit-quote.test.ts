import { describe, expect, it } from "vitest";
import { hash } from "starknet";
import {
  AVNU_FEE_BPS_MULTI_ROUTE,
  EKUBO_CORE_SEPOLIA,
  FULL_RANGE_SQRT_RATIO_DISTANCE,
  JIT_ROUTER_SEPOLIA,
  JitQuoteError,
  MAX_ROUTE_PERCENT,
  MULTI_ROUTE_SWAP_SELECTOR,
  STRK_SEPOLIA,
  USDC_SEPOLIA,
  buildAvnuRoutes,
  computeMinOut,
  encodeMultiRouteSwap,
  feltHex,
  getJitQuote,
  u256Parts,
  type EkuboSplit,
} from "@/server/card/jit";

const ETH_SEPOLIA =
  "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7";

const pool = (token0: string, token1: string, fee = "0") => ({
  pool_key: { token0, token1, fee, tick_spacing: 1000, extension: "0x0" },
  sqrt_ratio_limit: "0x1000003f7f1380b75",
  skip_ahead: 0,
});

describe("selector", () => {
  it("matches starknet_keccak of multi_route_swap, the felt JitConverter pops first", () => {
    expect(BigInt(MULTI_ROUTE_SWAP_SELECTOR)).toBe(
      BigInt(hash.getSelectorFromName("multi_route_swap")),
    );
  });
});

describe("u256Parts", () => {
  it("splits into low/high felts", () => {
    expect(u256Parts(0n)).toEqual([0n, 0n]);
    expect(u256Parts(2n ** 128n + 7n)).toEqual([7n, 1n]);
    const max128 = (1n << 128n) - 1n;
    expect(u256Parts(max128)).toEqual([max128, 0n]);
  });
});

describe("computeMinOut", () => {
  it("applies the AVNU buy-side fee, then the slippage bound, rounding down", () => {
    // 1_000_000 out, 10 bps fee -> 999_000; 1% slippage -> 989_010.
    expect(computeMinOut(1_000_000n, 10n, 100n)).toBe(989_010n);
  });

  it("is strictly below the quote and above zero for realistic quotes", () => {
    const quoted = 1_190_515n; // the live 2 STRK quote observed at block 14129540
    const minOut = computeMinOut(quoted, AVNU_FEE_BPS_MULTI_ROUTE, 100n);
    expect(minOut).toBeGreaterThan(0n);
    expect(minOut).toBeLessThan(quoted);
  });

  it("fails closed on zero quotes and nonsense slippage", () => {
    expect(() => computeMinOut(0n, 10n, 100n)).toThrow(JitQuoteError);
    expect(() => computeMinOut(1n, 10n, 100n)).toThrow(JitQuoteError);
    expect(() => computeMinOut(1_000_000n, 10n, 10_000n)).toThrow(JitQuoteError);
  });
});

describe("buildAvnuRoutes", () => {
  const twoSplits: EkuboSplit[] = [
    {
      amount_specified: "1500000000000000000",
      amount_calculated: "900000",
      route: [pool(ETH_SEPOLIA, STRK_SEPOLIA), pool(ETH_SEPOLIA, USDC_SEPOLIA)],
    },
    {
      amount_specified: "500000000000000000",
      amount_calculated: "290000",
      route: [pool(STRK_SEPOLIA, USDC_SEPOLIA, "170141183460469235273462165868118016")],
    },
  ];

  it("translates splits into sequential AVNU hops with correct percents", () => {
    const routes = buildAvnuRoutes(
      twoSplits,
      2_000_000_000_000_000_000n,
      STRK_SEPOLIA,
      USDC_SEPOLIA,
    );
    expect(routes).toHaveLength(3);

    // Split 1 hop 1: 75% of the STRK balance, direction STRK -> ETH.
    expect(routes[0].sellToken).toBe(feltHex(BigInt(STRK_SEPOLIA)));
    expect(routes[0].buyToken).toBe(feltHex(BigInt(ETH_SEPOLIA)));
    expect(routes[0].percent).toBe((MAX_ROUTE_PERCENT * 3n) / 4n);
    // Split 1 hop 2: all of the intermediate ETH, ETH -> USDC.
    expect(routes[1].sellToken).toBe(feltHex(BigInt(ETH_SEPOLIA)));
    expect(routes[1].buyToken).toBe(feltHex(BigInt(USDC_SEPOLIA)));
    expect(routes[1].percent).toBe(MAX_ROUTE_PERCENT);
    // Split 2 (last): sweeps 100% of the remaining STRK straight to USDC.
    expect(routes[2].sellToken).toBe(feltHex(BigInt(STRK_SEPOLIA)));
    expect(routes[2].buyToken).toBe(feltHex(BigInt(USDC_SEPOLIA)));
    expect(routes[2].percent).toBe(MAX_ROUTE_PERCENT);

    for (const route of routes) {
      expect(route.exchangeAddress).toBe(EKUBO_CORE_SEPOLIA);
      expect(route.additionalSwapParams).toHaveLength(6);
      expect(route.additionalSwapParams[5]).toBe(FULL_RANGE_SQRT_RATIO_DISTANCE);
    }
    // Pool key felts ride through verbatim: [token0, token1, fee, tick_spacing, extension, distance].
    expect(routes[2].additionalSwapParams[0]).toBe(BigInt(STRK_SEPOLIA));
    expect(routes[2].additionalSwapParams[1]).toBe(BigInt(USDC_SEPOLIA));
    expect(routes[2].additionalSwapParams[2]).toBe(
      170141183460469235273462165868118016n,
    );
    expect(routes[2].additionalSwapParams[3]).toBe(1000n);
    expect(routes[2].additionalSwapParams[4]).toBe(0n);
  });

  it("rejects splits that do not sum to the input", () => {
    expect(() =>
      buildAvnuRoutes(twoSplits, 1_000_000_000_000_000_000n, STRK_SEPOLIA, USDC_SEPOLIA),
    ).toThrow(/sum to/);
  });

  it("rejects a hop whose pool does not contain the incoming token", () => {
    const broken: EkuboSplit[] = [
      {
        amount_specified: "1000",
        amount_calculated: "1",
        route: [pool(ETH_SEPOLIA, USDC_SEPOLIA)],
      },
    ];
    expect(() => buildAvnuRoutes(broken, 1000n, STRK_SEPOLIA, USDC_SEPOLIA)).toThrow(
      /input token not in pool/,
    );
  });

  it("rejects routes that pass back through the sold token mid-path", () => {
    const reentrant: EkuboSplit[] = [
      {
        amount_specified: "1000",
        amount_calculated: "1",
        route: [
          pool(STRK_SEPOLIA, ETH_SEPOLIA),
          pool(ETH_SEPOLIA, STRK_SEPOLIA, "1"),
          pool(STRK_SEPOLIA, USDC_SEPOLIA),
        ],
      },
    ];
    expect(() =>
      buildAvnuRoutes(reentrant, 1000n, STRK_SEPOLIA, USDC_SEPOLIA),
    ).toThrow(/mis-route/);
  });

  it("rejects a path that ends on the wrong token", () => {
    const wrongEnd: EkuboSplit[] = [
      {
        amount_specified: "1000",
        amount_calculated: "1",
        route: [pool(STRK_SEPOLIA, ETH_SEPOLIA)],
      },
    ];
    expect(() => buildAvnuRoutes(wrongEnd, 1000n, STRK_SEPOLIA, USDC_SEPOLIA)).toThrow(
      /wrong token/,
    );
  });

  it("rejects an empty split set instead of inventing liquidity", () => {
    expect(() => buildAvnuRoutes([], 1000n, STRK_SEPOLIA, USDC_SEPOLIA)).toThrow(
      JitQuoteError,
    );
  });
});

describe("encodeMultiRouteSwap", () => {
  it("emits the selector first, then ABI-ordered args, as run_swap expects", () => {
    const beneficiary = "0x00000000000000000000000000000000000000000000000000000000000000ab";
    const calldata = encodeMultiRouteSwap({
      sellToken: STRK_SEPOLIA,
      amountIn: 2n ** 128n + 5n, // exercises a non-zero u256 high felt
      buyToken: USDC_SEPOLIA,
      quotedOut: 1_190_515n,
      minOut: 989_010n,
      beneficiary,
      routes: [
        {
          sellToken: STRK_SEPOLIA,
          buyToken: USDC_SEPOLIA,
          exchangeAddress: EKUBO_CORE_SEPOLIA,
          percent: MAX_ROUTE_PERCENT,
          additionalSwapParams: [
            BigInt(STRK_SEPOLIA),
            BigInt(USDC_SEPOLIA),
            170141183460469235273462165868118016n,
            1000n,
            0n,
            FULL_RANGE_SQRT_RATIO_DISTANCE,
          ],
        },
      ],
    });

    expect(calldata).toEqual([
      MULTI_ROUTE_SWAP_SELECTOR,
      feltHex(BigInt(STRK_SEPOLIA)),
      "0x5", // sell amount low
      "0x1", // sell amount high
      feltHex(BigInt(USDC_SEPOLIA)),
      feltHex(1_190_515n),
      "0x0",
      feltHex(989_010n),
      "0x0",
      "0xab",
      "0x0", // integrator fee bps
      "0x0", // integrator fee recipient
      "0x1", // routes len
      feltHex(BigInt(STRK_SEPOLIA)),
      feltHex(BigInt(USDC_SEPOLIA)),
      feltHex(BigInt(EKUBO_CORE_SEPOLIA)),
      feltHex(MAX_ROUTE_PERCENT),
      "0x6", // additional_swap_params len
      feltHex(BigInt(STRK_SEPOLIA)),
      feltHex(BigInt(USDC_SEPOLIA)),
      feltHex(170141183460469235273462165868118016n),
      feltHex(1000n),
      "0x0",
      feltHex(FULL_RANGE_SQRT_RATIO_DISTANCE),
    ]);
  });

  it("refuses zero beneficiaries and empty route sets", () => {
    const route = {
      sellToken: STRK_SEPOLIA,
      buyToken: USDC_SEPOLIA,
      exchangeAddress: EKUBO_CORE_SEPOLIA,
      percent: MAX_ROUTE_PERCENT,
      additionalSwapParams: [0n, 0n, 0n, 0n, 0n, 0n],
    };
    expect(() =>
      encodeMultiRouteSwap({
        sellToken: STRK_SEPOLIA,
        amountIn: 1n,
        buyToken: USDC_SEPOLIA,
        quotedOut: 1n,
        minOut: 1n,
        beneficiary: "0x0",
        routes: [route],
      }),
    ).toThrow(/beneficiary/);
    expect(() =>
      encodeMultiRouteSwap({
        sellToken: STRK_SEPOLIA,
        amountIn: 1n,
        buyToken: USDC_SEPOLIA,
        quotedOut: 1n,
        minOut: 1n,
        beneficiary: "0xab",
        routes: [],
      }),
    ).toThrow(/empty route/);
  });
});

describe("getJitQuote fail-closed", () => {
  it("throws JitQuoteError when the quoter has no route, never a silent fallback", async () => {
    const emptyQuoter = (async () =>
      new Response(
        JSON.stringify({ block_number: 1, total_calculated: "0", splits: [] }),
        { status: 200 },
      )) as unknown as typeof fetch;
    await expect(
      getJitQuote(1_000_000_000_000_000_000n, "0xab", { fetchImpl: emptyQuoter }),
    ).rejects.toMatchObject({ name: "JitQuoteError", reason: "no_liquidity" });
  });

  it("throws with reason network when the quoter is unreachable", async () => {
    const downQuoter = (async () => {
      throw new Error("getaddrinfo ENOTFOUND");
    }) as unknown as typeof fetch;
    await expect(
      getJitQuote(1_000_000_000_000_000_000n, "0xab", { fetchImpl: downQuoter }),
    ).rejects.toMatchObject({ name: "JitQuoteError", reason: "network" });
  });

  it("rejects zero and negative inputs before touching the network", async () => {
    await expect(getJitQuote(0n, "0xab")).rejects.toMatchObject({
      reason: "bad_input",
    });
    await expect(
      getJitQuote(1n, "0x0"),
    ).rejects.toMatchObject({ reason: "bad_input" });
  });
});

describe("live Ekubo sepolia quote", () => {
  // Hits https://prod-api-quoter.ekubo.org for a real 2 STRK -> USDC quote.
  // Skipped ONLY when the quoter is unreachable (offline CI); a reachable
  // quoter with no route is a hard failure, because that means the demo pair
  // lost its liquidity and the pinned deployment assumptions no longer hold.
  it("quotes 2 STRK to a non-zero USDC amount and encodes full calldata", async (ctx) => {
    let quote;
    try {
      quote = await getJitQuote(
        2_000_000_000_000_000_000n,
        "0x00000000000000000000000000000000000000000000000000000000000000ab",
      );
    } catch (error) {
      if (error instanceof JitQuoteError && error.reason === "network") {
        ctx.skip(`network unavailable: ${error.message}`);
        return;
      }
      throw error;
    }

    expect(quote.router).toBe(JIT_ROUTER_SEPOLIA);
    expect(quote.soldToken).toBe(STRK_SEPOLIA);
    expect(quote.boughtToken).toBe(USDC_SEPOLIA);
    expect(quote.quotedOut).toBeGreaterThan(0n);
    expect(quote.minOut).toBeGreaterThan(0n);
    expect(quote.minOut).toBeLessThan(quote.quotedOut);
    expect(quote.blockNumber).toBeGreaterThan(14_000_000);
    expect(quote.swapCalldata[0]).toBe(MULTI_ROUTE_SWAP_SELECTOR);
    // 13 header felts + at least one 11-felt route.
    expect(quote.swapCalldata.length).toBeGreaterThanOrEqual(24);
    const routeCount = Number(BigInt(quote.swapCalldata[12]));
    expect(routeCount).toBeGreaterThan(0);
    expect(quote.swapCalldata).toHaveLength(13 + routeCount * 11);
  }, 30_000);
});
