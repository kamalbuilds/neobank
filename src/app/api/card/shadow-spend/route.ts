import { enforceRateLimit, jsonError } from "@/app/api/avnu/lib";
import { isDemoAuthorizeEnabled } from "@/server/card/authorization";
import { DemoTokenError, consumeDemoToken } from "@/server/card/demo-token";
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
  nonce?: string;
  demoToken?: string;
};

function parseBody(body: unknown): ShadowSpendBody {
  if (!body || typeof body !== "object") return {};
  const { amountStrk, nonce, demoToken } = body as Record<string, unknown>;
  return {
    amountStrk: typeof amountStrk === "string" ? amountStrk : undefined,
    nonce: typeof nonce === "string" ? nonce : undefined,
    demoToken: typeof demoToken === "string" ? demoToken : undefined,
  };
}

export async function POST(request: Request) {
  // CARD_DEMO_AUTHORIZE is a deploy-time switch, not a per-request guard: it
  // must be "1" in production for the public demo button to work, so it
  // cannot be the only thing standing between this route and real hosted
  // funds. A caller must also present a server-minted, single-use demo token
  // (see /api/card/demo-token) and stay under the per-IP rate limit. The
  // payout recipient is never taken from the request - see shadow-spend.ts.
  if (!isDemoAuthorizeEnabled()) {
    return Response.json({ error: "shadow_spend_disabled" }, { status: 403 });
  }
  try {
    enforceRateLimit(request, "card-shadow-spend");
  } catch (error) {
    return jsonError(error);
  }
  const status = cardRuntimeStatus();
  if (!status.ready) {
    return Response.json(status, { status: 503 });
  }

  const body = parseBody(await request.json().catch(() => ({})));
  try {
    consumeDemoToken(body.demoToken);
  } catch (error) {
    if (error instanceof DemoTokenError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
    throw error;
  }
  try {
    const amount = parseStrkAmount(body.amountStrk ?? "0.1");
    const result = await executeShadowSpend({
      amount,
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
