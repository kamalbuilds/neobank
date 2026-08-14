import { buildPrivateSwapFee } from "@avnu/avnu-sdk";
import { TOKENS } from "@/utils/constants";
import { avnuOptions, jsonError, parseNetwork, poolAddress, requireAvnuKey } from "../lib";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const network = parseNetwork(body?.network);
    const key = requireAvnuKey();
    const feeMode = {
      poolFeeToken: typeof body?.poolFeeToken === "string" ? body.poolFeeToken : TOKENS.STRK.address,
      tip: body?.tip === "slow" || body?.tip === "fast" ? body.tip : "normal" as const,
    };
    const fee = await buildPrivateSwapFee(
      { poolAddress: poolAddress(network), feeMode, paymasterApiKey: key },
      avnuOptions(network)
    );
    return Response.json({
      token: fee.token,
      recipient: fee.recipient,
      amount: `0x${fee.amount.toString(16)}`,
      feeMode,
    });
  } catch (error) {
    return jsonError(error);
  }
}
