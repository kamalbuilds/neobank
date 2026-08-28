import { enforceRateLimit, jsonError } from "@/app/api/avnu/lib";
import { isDemoAuthorizeEnabled } from "@/server/card/authorization";
import { DemoTokenError, consumeDemoToken } from "@/server/card/demo-token";
import { cardRuntimeStatus } from "@/server/card/runtime";
import {
  JitSettlementConfigError,
  executeJitCardSettlement,
  jitReadinessWithConfig,
} from "@/server/card/jit-settlement";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  const readiness = await jitReadinessWithConfig();
  return Response.json(readiness, { status: readiness.ready ? 200 : 503 });
}

type JitBody = {
  authorizationId?: string;
  amountInStrk?: string;
  amountUsdMinor?: number;
  slippageBps?: number;
  demoToken?: string;
};

function parseBody(body: unknown): JitBody {
  if (!body || typeof body !== "object") return {};
  const { authorizationId, amountInStrk, amountUsdMinor, slippageBps, demoToken } =
    body as Record<string, unknown>;
  return {
    authorizationId: typeof authorizationId === "string" ? authorizationId : undefined,
    amountInStrk: typeof amountInStrk === "string" ? amountInStrk : undefined,
    amountUsdMinor: typeof amountUsdMinor === "number" ? amountUsdMinor : undefined,
    slippageBps: typeof slippageBps === "number" ? slippageBps : undefined,
    demoToken: typeof demoToken === "string" ? demoToken : undefined,
  };
}

export async function POST(request: Request) {
  // Same guard as the other operational triggers (demo-authorize,
  // shadow-spend): this endpoint moves real hosted funds, bypasses
  // evaluateCardPolicy, and is not authenticated by a Stripe webhook
  // signature. CARD_DEMO_AUTHORIZE alone is a deploy-time switch that must be
  // "1" in production for the demo button to work, so it cannot be the only
  // guard - a caller must also present a server-minted, single-use demo
  // token (see /api/card/demo-token) and stay under the per-IP rate limit.
  if (!isDemoAuthorizeEnabled()) {
    return Response.json({ error: "jit_settlement_disabled" }, { status: 403 });
  }
  try {
    enforceRateLimit(request, "card-jit");
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
  if (!body.authorizationId) {
    return Response.json({ error: "authorizationId is required" }, { status: 400 });
  }
  if (body.amountInStrk === undefined && body.amountUsdMinor === undefined) {
    return Response.json(
      { error: "Provide amountInStrk or amountUsdMinor" },
      { status: 400 },
    );
  }

  let amountInStrk: bigint | undefined;
  if (body.amountInStrk !== undefined) {
    try {
      amountInStrk = BigInt(body.amountInStrk);
    } catch {
      return Response.json({ error: "amountInStrk must be an integer string" }, { status: 400 });
    }
  }

  try {
    const result = await executeJitCardSettlement({
      authorizationId: body.authorizationId,
      amountInStrk,
      amountUsdMinor: body.amountUsdMinor,
      slippageBps: body.slippageBps,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof JitSettlementConfigError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 502 });
  }
}
