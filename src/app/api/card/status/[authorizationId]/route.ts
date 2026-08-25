import {
  readAuthorizationStatus,
  validateAuthorizationId,
} from "@/server/card/status";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ authorizationId: string }>;
};

export async function GET(_request: Request, { params }: Context) {
  const { authorizationId } = await params;
  if (!validateAuthorizationId(authorizationId)) {
    return Response.json({ error: "invalid_authorization_id" }, { status: 400 });
  }
  if (!process.env.CARD_SETTLEMENT_CONTRACT) {
    return Response.json(
      { error: "settlement_contract_unconfigured" },
      { status: 503 },
    );
  }

  try {
    return Response.json(await readAuthorizationStatus(authorizationId));
  } catch {
    return Response.json({ error: "status_unavailable" }, { status: 502 });
  }
}
