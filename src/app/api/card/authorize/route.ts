import { handleCardAuthorization } from "@/server/card/authorize";
import { cardRuntimeStatus } from "@/server/card/runtime";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  const status = cardRuntimeStatus();
  return Response.json(status, { status: status.ready ? 200 : 503 });
}

export async function POST(request: Request) {
  const result = await handleCardAuthorization({
    rawBody: await request.text(),
    signatureHeader: request.headers.get("stripe-signature"),
    waitForSettlement: new URL(request.url).searchParams.get("wait") === "1",
  });
  return Response.json(result.body, { status: result.httpStatus });
}
