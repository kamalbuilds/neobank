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
  const body = await request.json().catch(() => ({}));
  const dinner =
    body && typeof body === "object" && (body as { scene?: string }).scene === "grocery"
      ? {
          authorizationId: `iauth_demo_${now}`,
          amountMinor: 50,
          merchantName: "Corner Market",
          merchantCategory: "grocery_stores",
        }
      : {
          authorizationId: `iauth_dinner_${now}`,
          amountMinor: 24,
          merchantName: "Osteria Nova",
          merchantCategory: "restaurants",
        };
  const rawBody = buildIssuingAuthorizationEvent({
    eventId: `evt_demo_${now}`,
    authorizationId: dinner.authorizationId,
    amountMinor: dinner.amountMinor,
    merchantName: dinner.merchantName,
    merchantCountry: "US",
    merchantCategory: dinner.merchantCategory,
  });

  const result = await handleCardAuthorization({
    rawBody,
    signatureHeader: stripeSignatureHeader(rawBody, config.webhookSecret, now),
    waitForSettlement: new URL(request.url).searchParams.get("wait") === "1",
    nowMs: now * 1000,
  });
  return Response.json(
    {
      ...result.body,
      authorizationId: dinner.authorizationId,
      merchantName: dinner.merchantName,
      merchantCategory: dinner.merchantCategory,
    },
    { status: result.httpStatus },
  );
}
