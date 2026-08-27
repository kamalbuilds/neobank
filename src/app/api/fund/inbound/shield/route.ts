import { inboundRuntimeStatus, shieldInboundUsdc } from "@/server/fund/inbound.ts";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST /api/fund/inbound/shield { amountUnits }
 *
 * Deposits claimed USDC (base units, 6 decimals) from the hosted account's
 * public balance into the STRK20 privacy pool and verifies the shielded note
 * total grew by exactly that amount. Kept as an explicit second step so the
 * public mint and the private deposit are separately auditable.
 */
export async function POST(request: Request) {
  const status = inboundRuntimeStatus();
  if (!status.ready) {
    return Response.json(status, { status: 503 });
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
    const result = await shieldInboundUsdc(BigInt(amountUnits));
    return Response.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 502 });
  }
}
