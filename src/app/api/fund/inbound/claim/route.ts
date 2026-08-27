import { claimInboundTransfer, inboundRuntimeStatus } from "@/server/fund/inbound.ts";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST /api/fund/inbound/claim { burnTxHash }
 *
 * Fetches the Circle attestation for a Base Sepolia burn and submits
 * receive_message on the Starknet Sepolia MessageTransmitter with the hosted
 * account, polling the mint to a terminal receipt. Idempotent: an already
 * consumed nonce returns phase "already_claimed" instead of resubmitting.
 */
export async function POST(request: Request) {
  const status = inboundRuntimeStatus();
  if (!status.ready) {
    return Response.json(status, { status: 503 });
  }
  let burnTxHash: unknown;
  try {
    ({ burnTxHash } = await request.json());
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }
  if (typeof burnTxHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(burnTxHash)) {
    return Response.json(
      { error: "burnTxHash must be a 0x-prefixed 32-byte transaction hash." },
      { status: 400 },
    );
  }
  try {
    const result = await claimInboundTransfer(burnTxHash);
    return Response.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const notReady = message.includes("Attestation not ready") || message.includes("no message");
    return Response.json({ error: message }, { status: notReady ? 409 : 502 });
  }
}
