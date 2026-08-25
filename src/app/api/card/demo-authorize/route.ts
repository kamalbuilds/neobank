import {
  buildIssuingAuthorizationEvent,
  isDemoAuthorizeEnabled,
  stripeSignatureHeader,
} from "@/server/card/authorization";
import { handleCardAuthorization } from "@/server/card/authorize";
import { cardRuntimeStatus, parseCardRuntimeConfig } from "@/server/card/runtime";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!isDemoAuthorizeEnabled()) {
    return Response.json({ error: "demo_authorize_disabled" }, { status: 403 });
  }

  const runtime = cardRuntimeStatus();
  if (!runtime.ready) {
    return Response.json(runtime, { status: 503 });
  }

  const config = parseCardRuntimeConfig();
  const now = Math.floor(Date.now() / 1000);
  const authorizationId = `iauth_demo_${now}`;
  const rawBody = buildIssuingAuthorizationEvent({
    eventId: `evt_demo_${now}`,
    authorizationId,
    amountMinor: 50,
    merchantName: "STRK20 Demo Merchant",
    merchantCountry: "US",
    merchantCategory: "grocery_stores",
  });

  const result = await handleCardAuthorization({
    rawBody,
    signatureHeader: stripeSignatureHeader(rawBody, config.webhookSecret, now),
    waitForSettlement: new URL(request.url).searchParams.get("wait") === "1",
    nowMs: now * 1000,
  });
  return Response.json(
    { ...result.body, authorizationId },
    { status: result.httpStatus },
  );
}
