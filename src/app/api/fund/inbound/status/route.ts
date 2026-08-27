import { inboundRuntimeStatus, inboundStatus } from "@/server/fund/inbound.ts";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/fund/inbound/status            -> inbound runtime readiness
 * GET /api/fund/inbound/status?tx=0x...   -> phase of one Base Sepolia burn
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tx = url.searchParams.get("tx");
  if (!tx) {
    const status = inboundRuntimeStatus();
    return Response.json(status, { status: status.ready ? 200 : 503 });
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(tx)) {
    return Response.json(
      { error: "tx must be a 0x-prefixed 32-byte transaction hash." },
      { status: 400 },
    );
  }
  try {
    const status = await inboundStatus(tx);
    return Response.json(status);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 502 });
  }
}
