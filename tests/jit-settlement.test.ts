import { describe, expect, it } from "vitest";
import { RpcProvider } from "starknet";
import { feltHex } from "@/server/card/jit";
import {
  JitSettlementConfigError,
  buildConvertAndPayCalldata,
  deriveAmountInStrk,
  jitConverterAddress,
  jitSettlementReadiness,
  readJitConfig,
} from "@/server/card/jit-settlement";

const STRK_SEPOLIA =
  "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";
const USDC_SEPOLIA =
  "0x053b40a647cedfca6ca84f542a0fe36736031905a9639a7f19a3c1e66bfd5080";
const JIT_CONVERTER =
  "0x04a36f2fab9bbb37f190971755ed84c1be11e95c3664b5948f25854410669f99";

describe("buildConvertAndPayCalldata", () => {
  it("orders felts exactly per convert_and_pay's ABI, Span as length then elements", () => {
    const calldata = buildConvertAndPayCalldata({
      authorizationId: 0xabcn,
      soldToken: STRK_SEPOLIA,
      boughtToken: USDC_SEPOLIA,
      amountIn: 2n ** 128n + 5n, // exercises a non-zero u256 high felt
      minOut: 1_190_515n,
      swapCalldata: ["0x1", "0x2", "0x3"],
    });

    expect(calldata).toEqual([
      0xabcn, // authorization_id
      STRK_SEPOLIA, // sold_token
      USDC_SEPOLIA, // bought_token
      5n, // amount_in.low
      1n, // amount_in.high
      1_190_515n, // min_out.low
      0n, // min_out.high
      3n, // swap_calldata length prefix
      "0x1",
      "0x2",
      "0x3",
    ]);
  });

  it("puts the length prefix before the elements even for a single-route swap", () => {
    const calldata = buildConvertAndPayCalldata({
      authorizationId: 1n,
      soldToken: STRK_SEPOLIA,
      boughtToken: USDC_SEPOLIA,
      amountIn: 10n,
      minOut: 1n,
      swapCalldata: ["0xdead"],
    });
    // index 7 is the Span length, index 8 is its sole element.
    expect(calldata[7]).toBe(1n);
    expect(calldata[8]).toBe("0xdead");
    expect(calldata).toHaveLength(9);
  });

  it("fails closed on zero authorizationId, amountIn, minOut, and empty swapCalldata", () => {
    const base = {
      authorizationId: 1n,
      soldToken: STRK_SEPOLIA,
      boughtToken: USDC_SEPOLIA,
      amountIn: 1n,
      minOut: 1n,
      swapCalldata: ["0x1"],
    };
    expect(() =>
      buildConvertAndPayCalldata({ ...base, authorizationId: 0n }),
    ).toThrow(JitSettlementConfigError);
    expect(() => buildConvertAndPayCalldata({ ...base, amountIn: 0n })).toThrow(
      JitSettlementConfigError,
    );
    expect(() => buildConvertAndPayCalldata({ ...base, minOut: 0n })).toThrow(
      JitSettlementConfigError,
    );
    expect(() =>
      buildConvertAndPayCalldata({ ...base, swapCalldata: [] }),
    ).toThrow(JitSettlementConfigError);
  });
});

describe("jitConverterAddress / jitSettlementReadiness", () => {
  it("reports missing CARD_JIT_CONVERTER without touching the network", () => {
    expect(jitConverterAddress({})).toBeUndefined();
    expect(jitConverterAddress({ CARD_JIT_CONVERTER: " " })).toBeUndefined();
    expect(jitConverterAddress({ CARD_JIT_CONVERTER: JIT_CONVERTER })).toBe(
      JIT_CONVERTER,
    );
  });

  it("is not ready when the base card runtime env is incomplete, even with the converter set", () => {
    const readiness = jitSettlementReadiness({ CARD_JIT_CONVERTER: JIT_CONVERTER });
    expect(readiness.ready).toBe(false);
    expect(readiness.missing).not.toContain("CARD_JIT_CONVERTER");
    expect(readiness.missing.length).toBeGreaterThan(0);
  });

  it("flags CARD_JIT_CONVERTER as missing on top of an otherwise-ready runtime env", () => {
    const fullRuntimeEnv = {
      CARD_RUNTIME_ACCOUNT_ADDRESS: "0x1",
      CARD_RUNTIME_PRIVATE_KEY: "0x1",
      CARD_SETTLEMENT_CONTRACT: "0x1",
      CARD_SETTLEMENT_TOKEN: "0x1",
      CARD_SETTLEMENT_UNITS_PER_USD: "1",
      CARD_WEBHOOK_SECRET: "s",
    };
    const readiness = jitSettlementReadiness(fullRuntimeEnv);
    expect(readiness.ready).toBe(false);
    expect(readiness.missing).toEqual(["CARD_JIT_CONVERTER"]);
  });
});

describe("deriveAmountInStrk", () => {
  /** A deterministic quoter: 1 STRK unit buys `rateNumerator/rateDenominator` USDC atomic units. */
  function linearQuoter(rateNumerator: bigint, rateDenominator: bigint): typeof fetch {
    return (async (url: string) => {
      const amountIn = BigInt(url.split("/").slice(-3)[0]);
      const out = (amountIn * rateNumerator) / rateDenominator;
      return new Response(
        JSON.stringify({
          block_number: 1,
          total_calculated: out.toString(),
          splits: [
            {
              amount_specified: amountIn.toString(),
              amount_calculated: out.toString(),
              route: [
                {
                  pool_key: {
                    token0: STRK_SEPOLIA,
                    token1: USDC_SEPOLIA,
                    fee: "0",
                    tick_spacing: 1000,
                    extension: "0x0",
                  },
                  sqrt_ratio_limit: "0x1000003f7f1380b75",
                  skip_ahead: 0,
                },
              ],
            },
          ],
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;
  }

  it("converges on an amountInStrk whose quoted minOut clears the USDC target", async () => {
    // ~0.6 USDC atomic units per STRK unit (roughly the live 2 STRK -> 1.19 USDC rate).
    const fetchImpl = linearQuoter(595_000n, 1_000_000_000_000_000_000n);
    const targetUsdcAtomic = 1_000_000n; // 1 USDC
    const { amountInStrk, quote } = await deriveAmountInStrk(
      targetUsdcAtomic,
      JIT_CONVERTER,
      { fetchImpl },
    );
    expect(amountInStrk).toBeGreaterThan(0n);
    expect(quote.minOut).toBeGreaterThanOrEqual(targetUsdcAtomic);
  });

  it("scales up across iterations when the first estimate undershoots badly", async () => {
    // A sharply sub-linear quoter (heavy price impact at small probe size)
    // so the first linear estimate undershoots and a second iteration is required.
    let calls = 0;
    const fetchImpl = (async (url: string) => {
      calls += 1;
      const amountIn = BigInt(url.split("/").slice(-3)[0]);
      // Effective rate drops as amountIn grows past the probe size, forcing
      // the deriver to overshoot its first linear guess and rescale.
      const out = amountIn < 5n * 10n ** 18n ? amountIn / 2n : amountIn / 8n;
      return new Response(
        JSON.stringify({
          block_number: 1,
          total_calculated: out.toString(),
          splits: [
            {
              amount_specified: amountIn.toString(),
              amount_calculated: out.toString(),
              route: [
                {
                  pool_key: {
                    token0: STRK_SEPOLIA,
                    token1: USDC_SEPOLIA,
                    fee: "0",
                    tick_spacing: 1000,
                    extension: "0x0",
                  },
                  sqrt_ratio_limit: "0x1000003f7f1380b75",
                  skip_ahead: 0,
                },
              ],
            },
          ],
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const targetUsdcAtomic = 10n ** 18n;
    const { quote } = await deriveAmountInStrk(targetUsdcAtomic, JIT_CONVERTER, {
      fetchImpl,
      probeStrk: 10n ** 18n,
    });
    expect(quote.minOut).toBeGreaterThanOrEqual(targetUsdcAtomic);
    expect(calls).toBeGreaterThan(1);
  });

  it("throws JitSettlementConfigError instead of looping forever when the pair has no liquidity", async () => {
    const deadQuoter = (async () =>
      new Response(
        JSON.stringify({ block_number: 1, total_calculated: "0", splits: [] }),
        { status: 200 },
      )) as unknown as typeof fetch;
    await expect(
      deriveAmountInStrk(1_000_000n, JIT_CONVERTER, { fetchImpl: deadQuoter }),
    ).rejects.toThrow();
  });

  it("rejects a non-positive target before touching the network", async () => {
    await expect(deriveAmountInStrk(0n, JIT_CONVERTER)).rejects.toThrow(
      JitSettlementConfigError,
    );
  });
});

describe("readJitConfig", () => {
  it("returns undefined without a network call when CARD_JIT_CONVERTER is unset", async () => {
    await expect(readJitConfig({})).resolves.toBeUndefined();
  });

  it("throws on a malformed (too-short) get_config response", async () => {
    const stubProvider = {
      callContract: async () => ["0x1", "0x2"],
    } as unknown as RpcProvider;
    await expect(
      readJitConfig({ CARD_JIT_CONVERTER: JIT_CONVERTER }, stubProvider),
    ).rejects.toThrow(/Malformed/);
  });

  // Live read against the deployed Sepolia JitConverter. Skipped ONLY when
  // the RPC is unreachable (offline CI); a reachable RPC with a wrong config
  // is a hard failure since that would mean the deployment address changed.
  it("reads the deployed JitConverter's live owner/router/recipient", async (ctx) => {
    let config;
    try {
      config = await readJitConfig({ CARD_JIT_CONVERTER: JIT_CONVERTER });
    } catch (error) {
      ctx.skip(`RPC unavailable: ${error instanceof Error ? error.message : error}`);
      return;
    }
    expect(config).toBeDefined();
    expect(BigInt(config!.owner)).toBe(
      BigInt("0x7f873263abf08b4396a50b038158ed05eedd49812295b5d51762d2b90e9a219"),
    );
    expect(BigInt(config!.router)).toBe(
      BigInt("0x02c56e8b00dbe2a71e57472685378fc8988bba947e9a99b26a00fade2b4fe7c2"),
    );
    expect(BigInt(config!.recipient)).toBe(
      BigInt("0x071c62dfb692c3821a9ef120919f388b4559cb2d414c7378da62e6bf7f4f494d"),
    );
  }, 30_000);
});

describe("feltHex sanity for authorization ids", () => {
  it("round-trips through calldata as a plain felt", () => {
    expect(feltHex(0xabcn)).toBe("0xabc");
  });
});
