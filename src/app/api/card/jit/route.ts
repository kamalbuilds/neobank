import { isDemoAuthorizeEnabled } from "@/server/card/authorization";
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
};

function parseBody(body: unknown): JitBody {
  if (!body || typeof body !== "object") return {};
  const { authorizationId, amountInStrk, amountUsdMinor, slippageBps } =
    body as Record<string, unknown>;
  return {
    authorizationId: typeof authorizationId === "string" ? authorizationId : undefined,
    amountInStrk: typeof amountInStrk === "string" ? amountInStrk : undefined,
    amountUsdMinor: typeof amountUsdMinor === "number" ? amountUsdMinor : undefined,
    slippageBps: typeof slippageBps === "number" ? slippageBps : undefined,
  };
}

export async function POST(request: Request) {
  // Same guard as the other operational triggers (demo-authorize,
  // shadow-spend): this endpoint moves real hosted funds and is not
  // authenticated by a Stripe webhook signature, so it stays behind the
  // explicit demo-authorize flag rather than being open by default.
  if (!isDemoAuthorizeEnabled()) {
    return Response.json({ error: "jit_settlement_disabled" }, { status: 403 });
  }

  const status = cardRuntimeStatus();
  if (!status.ready) {
    return Response.json(status, { status: 503 });
  }

  const body = parseBody(await request.json().catch(() => ({})));
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
