import { listSettledAuthorizations } from "@/server/card/status";

export const runtime = "nodejs";

export async function GET() {
  if (!process.env.CARD_SETTLEMENT_CONTRACT) {
    return Response.json(
      { error: "settlement_contract_unconfigured" },
      { status: 503 },
    );
  }

  try {
    return Response.json(await listSettledAuthorizations());
  } catch {
    return Response.json({ error: "settlements_unavailable" }, { status: 502 });
  }
}
