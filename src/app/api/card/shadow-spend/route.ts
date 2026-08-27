import { isDemoAuthorizeEnabled } from "@/server/card/authorization";
import { cardRuntimeStatus } from "@/server/card/runtime";
import {
  ShadowSpendConfigError,
  executeShadowSpend,
  parseStrkAmount,
} from "@/server/card/shadow-spend";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  const status = cardRuntimeStatus();
  return Response.json(
    { ...status, shadowSpendEnabled: isDemoAuthorizeEnabled() },
    { status: status.ready ? 200 : 503 },
  );
}

type ShadowSpendBody = {
  amountStrk?: string;
  recipient?: string;
  nonce?: string;
};

function parseBody(body: unknown): ShadowSpendBody {
  if (!body || typeof body !== "object") return {};
  const { amountStrk, recipient, nonce } = body as Record<string, unknown>;
  return {
    amountStrk: typeof amountStrk === "string" ? amountStrk : undefined,
    recipient: typeof recipient === "string" ? recipient : undefined,
    nonce: typeof nonce === "string" ? nonce : undefined,
  };
}

export async function POST(request: Request) {
  if (!isDemoAuthorizeEnabled()) {
    return Response.json({ error: "shadow_spend_disabled" }, { status: 403 });
  }
  const status = cardRuntimeStatus();
  if (!status.ready) {
    return Response.json(status, { status: 503 });
  }

  const body = parseBody(await request.json().catch(() => ({})));
  try {
    const amount = parseStrkAmount(body.amountStrk ?? "0.1");
    const result = await executeShadowSpend({
      amount,
      recipient: body.recipient,
      nonce: body.nonce !== undefined ? BigInt(body.nonce) : undefined,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof ShadowSpendConfigError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 502 });
  }
}
