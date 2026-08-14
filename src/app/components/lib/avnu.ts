import {
  BASE_URL,
  createStrk20WalletProver,
  quoteToCalls,
  SEPOLIA_BASE_URL,
  type AvnuOptions,
  type PrivateFeeMode,
  type PrivateSwapFee,
  type Quote,
} from "@avnu/avnu-sdk";
import type { WalletAccountV6 } from "starknet";
import type { NetworkKey } from "@/utils/constants";

export function clientAvnuOptions(network: NetworkKey): AvnuOptions {
  return { baseUrl: network === "sepolia" ? SEPOLIA_BASE_URL : BASE_URL };
}

export async function avnuConfigured(): Promise<boolean> {
  const res = await fetch("/api/avnu/status");
  if (!res.ok) return false;
  const body = (await res.json()) as { configured?: boolean };
  return Boolean(body.configured);
}

export async function fetchPrivateSwapFee(
  network: NetworkKey,
  poolFeeToken: string
): Promise<{ fee: PrivateSwapFee; feeMode: PrivateFeeMode }> {
  const res = await fetch("/api/avnu/fee", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ network, poolFeeToken, tip: "normal" }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error ?? "Could not read the AVNU pool fee.");
  return {
    fee: {
      token: String(body.token),
      recipient: String(body.recipient),
      amount: BigInt(body.amount),
    },
    feeMode: body.feeMode as PrivateFeeMode,
  };
}

export async function proveAndSubmitPrivateSwap(params: {
  network: NetworkKey;
  walletAccount: WalletAccountV6;
  quote: Quote;
  slippage: number;
  takerAddress: string;
  fee: PrivateSwapFee;
  feeMode: PrivateFeeMode;
}): Promise<string> {
  const options = clientAvnuOptions(params.network);
  const built = await quoteToCalls(
    { quoteId: params.quote.quoteId, slippage: params.slippage, private: true },
    options
  );
  if (!built.executorAddress) {
    throw new Error("AVNU did not return a private executor for this quote.");
  }
  const prover = createStrk20WalletProver(params.walletAccount);
  const callAndProof = await prover.buildAndProve({
    sellTokenAddress: params.quote.sellTokenAddress,
    sellAmount: params.quote.sellAmount,
    buyTokenAddress: params.quote.buyTokenAddress,
    executorAddress: built.executorAddress,
    executorCalls: built.calls,
    fee: params.fee,
    takerAddress: params.takerAddress,
  });
  const res = await fetch("/api/avnu/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      network: params.network,
      feeMode: params.feeMode,
      callAndProof: {
        call: {
          contractAddress: callAndProof.call.contractAddress,
          entrypoint: callAndProof.call.entrypoint,
          calldata: callAndProof.call.calldata ?? [],
        },
        proof: callAndProof.proof,
      },
    }),
  });
  const body = await res.json();
  if (!res.ok || !body?.transactionHash) {
    throw new Error(body?.error ?? "AVNU did not accept the proven swap.");
  }
  return String(body.transactionHash);
}
