import { executeInboundBaseBurn, inboundRuntimeStatus } from "@/server/fund/inbound.ts";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST /api/fund/inbound/burn { amountUnits }
 *
 * Burns USDC on Base Sepolia toward the hosted Starknet account via CCTP V2
 * depositForBurn (Standard Transfer). Requires INBOUND_EVM_PRIVATE_KEY in the
 * server environment; fails closed with 503 when absent. The primary product
 * path is the user burning from their own Base wallet toward the address the
 * fund page shows - this route exists for hosted end-to-end runs.
 */
export async function POST(request: Request) {
  const status = inboundRuntimeStatus();
  if (!status.ready || !status.evmSignerConfigured) {
    return Response.json(
      {
        ...status,
        missing: [
          ...status.missing,
          ...(status.evmSignerConfigured ? [] : ["INBOUND_EVM_PRIVATE_KEY"]),
        ],
      },
      { status: 503 },
    );
  }
  let amountUnits: unknown;
  try {
    ({ amountUnits } = await request.json());
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }
  if (typeof amountUnits !== "string" || !/^[1-9]\d*$/.test(amountUnits)) {
    return Response.json(
      { error: "amountUnits must be a positive integer string of USDC base units." },
      { status: 400 },
    );
  }
  try {
    const result = await executeInboundBaseBurn(BigInt(amountUnits));
    return Response.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 502 });
  }
}
