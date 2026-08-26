import { RpcProvider, constants as SNconstants } from "starknet";
import { withRetry } from "@/app/components/lib/rpcRetry";

// ─── Networks ────────────────────────────────────────────────────────────

export type NetworkKey = "mainnet" | "sepolia";

export const NETWORKS: Record<NetworkKey, { label: string; chainId: string }> = {
  mainnet: { label: "Mainnet", chainId: SNconstants.StarknetChainId.SN_MAIN },
  sepolia: { label: "Sepolia", chainId: SNconstants.StarknetChainId.SN_SEPOLIA },
};

// Sepolia is the pre-wallet default. A connected wallet's own chainId overrides this.
export const DEFAULT_NETWORK: NetworkKey = "sepolia";

export function networkForChainId(chainId: string): NetworkKey | undefined {
  for (const key of Object.keys(NETWORKS) as NetworkKey[]) {
    if (BigInt(chainId) === BigInt(NETWORKS[key].chainId)) return key;
  }
  return undefined;
}

// Resolution order: an explicit full RPC URL, then an Alchemy key suffix, then
// a public endpoint.
//
// Next.js inlines only NEXT_PUBLIC_* into the browser bundle, and every call
// here runs client side, so a bare MAINNET_RPC / TESTNET_RPC is invisible at
// runtime. Both spellings are read so a prefixed value works and an unprefixed
// one at least works in server components instead of silently doing nothing.
function rpcUrl(network: NetworkKey): string {
  const explicit =
    network === "mainnet"
      ? process.env.NEXT_PUBLIC_MAINNET_RPC || process.env.MAINNET_RPC
      : process.env.NEXT_PUBLIC_TESTNET_RPC || process.env.TESTNET_RPC;
  if (explicit) return explicit;

  const alchemyKey = process.env.NEXT_PUBLIC_PROVIDER_URL;
  if (alchemyKey) {
    return network === "mainnet"
      ? `https://starknet-mainnet.g.alchemy.com/starknet/version/rpc/v0_10/${alchemyKey}`
      : `https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/${alchemyKey}`;
  }
  // blastapi.io is retired and now answers every call with "Blast API is no
  // longer available", so the Sepolia fallback silently failed every request.
  // Both endpoints below were checked against starknet_blockNumber.
  return network === "mainnet"
    ? "https://rpc.starknet.lava.build"
    : "https://starknet-sepolia-rpc.publicnode.com";
}

// A fresh RpcProvider for the given network. Never reuse the WalletAccount's
// provider for polling - it is frozen to whatever network was active at connect.
export function providerFor(network: NetworkKey): RpcProvider {
  return new RpcProvider({ nodeUrl: rpcUrl(network) });
}

export const explorerTxUrl = (network: NetworkKey, hash: string): string =>
  network === "mainnet" ? `https://voyager.online/tx/${hash}` : `https://sepolia.voyager.online/tx/${hash}`;

export const explorerAddressUrl = (network: NetworkKey, address: string): string =>
  network === "mainnet"
    ? `https://voyager.online/contract/${address}`
    : `https://sepolia.voyager.online/contract/${address}`;

// ─── Tokens ──────────────────────────────────────────────────────────────

export type TokenSymbol = "STRK" | "USDC";

export interface TokenConfig {
  symbol: TokenSymbol;
  address: string;
  decimals: number;
}

// Mainnet addresses, verified against the AVNU token list (starknet.api.avnu.fi).
export const TOKENS: Record<TokenSymbol, TokenConfig> = {
  STRK: {
    symbol: "STRK",
    address: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
    decimals: 18,
  },
  USDC: {
    symbol: "USDC",
    address: "0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb",
    decimals: 6,
  },
};

export const TOKEN_LIST: TokenConfig[] = [TOKENS.STRK, TOKENS.USDC];

export function tokenForAddress(address: string): TokenConfig | undefined {
  return TOKEN_LIST.find((t) => BigInt(t.address) === BigInt(address));
}

// ─── STRK20 pool ─────────────────────────────────────────────────────────

// The pool is deployed on both networks, and Sepolia is where iteration belongs:
// every mainnet pool action costs the live fee in real STRK, so a testnet run is
// the difference between rehearsing a flow and paying to rehearse it.
//
// mainnet: https://voyager.online/contract/0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a
// sepolia: https://sepolia.voyager.online/contract/0x0254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91
//          verified on chain as "Starknet: Canonical Privacy Pool", class alias Privacy.
export const STRK20_POOL_ADDRESSES: Record<NetworkKey, string> = {
  mainnet: "0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a",
  sepolia: "0x0254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91",
};

export function poolAddressFor(network: NetworkKey): string {
  return STRK20_POOL_ADDRESSES[network];
}

/** @deprecated Use poolAddressFor(network). Kept so mainnet callers keep working. */
export const STRK20_POOL_ADDRESS = STRK20_POOL_ADDRESSES.mainnet;

// Our helpers are deployed on Sepolia for rehearsal. Keep mainnet explicitly
// empty so a mainnet wallet can never invoke a testnet address by accident.
export const ANONYMIZER_ADDRESSES = {
  mainnet: {
    privatePayout: null,
    privateSpend: null,
    programmableSpend: null,
    cardSettlement: null,
    earnVault: null,
    earnAdapter: null,
  },
  sepolia: {
    privatePayout: "0x042fd2df34df378e33c2c0cbc3e0183974b2ca69c0d222da2326a5bfd64ec2c3",
    privateSpend: "0x054d94bbe6640e1258a1961ab1226fcb7cb0a9bfdcd72dab8857195e552dc334",
    programmableSpend: "0x0604a76fd7f50d4856cadbc1b6c45908d3be856fde267435124b7a74a7dcbbb0",
    cardSettlement: "0x074dcd5ee5e0fbfdcf25a7cbc3408711de19fccdf46e8f53c71d35e795f5390a",
    earnVault: "0x076811f28a950b5c6ddaa02bd323b5fccb572676ff57bbc3b979a430f0acda8b",
    earnAdapter: "0x0137d48e53d94333568cedfe8c261b7f3c8ff9206636f6f759c87137da5631f7",
  },
} as const satisfies Record<
  NetworkKey,
  {
    privatePayout: string | null;
    privateSpend: string | null;
    programmableSpend: string | null;
    cardSettlement: string | null;
    earnVault: string | null;
    earnAdapter: string | null;
  }
>;

// Pool fee is charged per private operation, always in STRK, and is admin
// settable (`set_fee_amount`) - read it at runtime, never hardcode a figure.
export async function getPoolFeeAmount(network: NetworkKey): Promise<bigint> {
  const provider = providerFor(network);
  const result = await provider.callContract({
    contractAddress: poolAddressFor(network),
    entrypoint: "get_fee_amount",
    calldata: [],
  });
  return BigInt(result[0]);
}

// Standard ERC-20 `balanceOf`, used for the shield flow's public MAX (the
// STRK20 pool fee is a public STRK payment, not something a viewing key can read).
export async function getPublicBalance(
  network: NetworkKey,
  token: string,
  account: string
): Promise<bigint> {
  const provider = providerFor(network);
  const result = await withRetry(() => provider.callContract({
    contractAddress: token,
    entrypoint: "balanceOf",
    calldata: [account],
  }));
  const low = BigInt(result[0]);
  const high = BigInt(result[1] ?? "0x0");
  return low + (high << 128n);
}

// ─── Circle CCTP V2 (Starknet mainnet) ──────────────────────────────────
// Contracts + domains from https://developers.circle.com/cctp/references/starknet-contracts
// and github.com/circlefin/starknet-cctp. CCTP only burns native USDC
// (TOKENS.USDC above) - never the bridged USDC.e address.

export type CctpChain = "base" | "solana";

export const CCTP = {
  starknetDomain: 25,
  domains: { base: 6, solana: 5 } satisfies Record<CctpChain, number>,
  tokenMessengerMinter: "0x07d421B9cA8aA32DF259965cDA8ACb93F7599F69209A41872AE84638B2A20F2a",
  messageTransmitter: "0x02EBB5777B6dD8B26ea11D68Fdf1D2c85cD2099335328Be845a28c77A8AEf183",
  bridgedUsdcE: "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8",
} as const;
