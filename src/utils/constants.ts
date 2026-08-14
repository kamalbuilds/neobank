import { RpcProvider, constants as SNconstants } from "starknet";

// ─── Networks ────────────────────────────────────────────────────────────

export type NetworkKey = "mainnet" | "sepolia";

export const NETWORKS: Record<NetworkKey, { label: string; chainId: string }> = {
  mainnet: { label: "Mainnet", chainId: SNconstants.StarknetChainId.SN_MAIN },
  sepolia: { label: "Sepolia", chainId: SNconstants.StarknetChainId.SN_SEPOLIA },
};

// Mainnet is the sprint default. A connected wallet's own chainId overrides this.
export const DEFAULT_NETWORK: NetworkKey = "mainnet";

export function networkForChainId(chainId: string): NetworkKey | undefined {
  for (const key of Object.keys(NETWORKS) as NetworkKey[]) {
    if (BigInt(chainId) === BigInt(NETWORKS[key].chainId)) return key;
  }
  return undefined;
}

// NEXT_PUBLIC_PROVIDER_URL holds only an Alchemy key suffix. Empty -> public RPCs.
function rpcUrl(network: NetworkKey): string {
  const alchemyKey = process.env.NEXT_PUBLIC_PROVIDER_URL;
  if (alchemyKey) {
    return network === "mainnet"
      ? `https://starknet-mainnet.g.alchemy.com/starknet/version/rpc/v0_10/${alchemyKey}`
      : `https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/${alchemyKey}`;
  }
  return network === "mainnet"
    ? "https://rpc.starknet.lava.build"
    : "https://starknet-sepolia.public.blastapi.io/rpc/v0_8";
}

// A fresh RpcProvider for the given network. Never reuse the WalletAccount's
// provider for polling - it is frozen to whatever network was active at connect.
export function providerFor(network: NetworkKey): RpcProvider {
  return new RpcProvider({ nodeUrl: rpcUrl(network) });
}

export const explorerTxUrl = (network: NetworkKey, hash: string): string =>
  network === "mainnet" ? `https://voyager.online/tx/${hash}` : `https://sepolia.voyager.online/tx/${hash}`;

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

export const STRK20_POOL_ADDRESS =
  "0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a";

// Pool fee is charged per private operation, always in STRK, and is admin
// settable (`set_fee_amount`) - read it at runtime, never hardcode a figure.
export async function getPoolFeeAmount(network: NetworkKey): Promise<bigint> {
  const provider = providerFor(network);
  const result = await provider.callContract({
    contractAddress: STRK20_POOL_ADDRESS,
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
  const result = await provider.callContract({
    contractAddress: token,
    entrypoint: "balanceOf",
    calldata: [account],
  });
  const low = BigInt(result[0]);
  const high = BigInt(result[1] ?? "0x0");
  return low + (high << 128n);
}
