import { submitPrivateSwap, type PrivateSwapCallAndProof } from "@avnu/avnu-sdk";
import { TOKENS } from "@/utils/constants";
import { avnuOptions, enforceRateLimit, jsonError, parseNetwork, requireAvnuKey } from "../lib";

function parseCallAndProof(raw: unknown): PrivateSwapCallAndProof {
  const value = raw as {
    call?: { contractAddress?: string; entrypoint?: string; calldata?: unknown };
    proof?: { data?: string; proofFacts?: unknown };
  } | undefined;
  const contractAddress = value?.call?.contractAddress;
  const entrypoint = value?.call?.entrypoint;
  const data = value?.proof?.data;
  const proofFacts = value?.proof?.proofFacts;
  if (!contractAddress || !entrypoint || typeof data !== "string" || !Array.isArray(proofFacts)) {
    throw Object.assign(new Error("Malformed proven swap payload."), { status: 400 });
  }
  const calldata = Array.isArray(value?.call?.calldata)
    ? value.call.calldata.map((item) => String(item))
    : [];
  return {
    call: { contractAddress, entrypoint, calldata },
    proof: { data, proofFacts: proofFacts.map((item) => String(item)) },
  };
}

export async function POST(request: Request) {
  try {
    enforceRateLimit(request, "submit");
    const body = await request.json();
    const network = parseNetwork(body?.network);
    const key = requireAvnuKey();
    const feeMode = {
      poolFeeToken: typeof body?.feeMode?.poolFeeToken === "string" ? body.feeMode.poolFeeToken : TOKENS.STRK.address,
      tip: body?.feeMode?.tip === "slow" || body?.feeMode?.tip === "fast" ? body.feeMode.tip : "normal" as const,
    };
    const result = await submitPrivateSwap(
      { callAndProof: parseCallAndProof(body?.callAndProof), feeMode, paymasterApiKey: key },
      avnuOptions(network)
    );
    return Response.json({ transactionHash: result.transactionHash });
  } catch (error) {
    return jsonError(error);
  }
}
