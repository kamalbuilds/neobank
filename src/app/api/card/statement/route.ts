import { cardRuntimeStatus } from "@/server/card/runtime";
import {
  buildCardStatement,
  parseStatementQuery,
} from "@/server/card/statement";
import { validateAuthorizationId } from "@/server/card/status";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const status = cardRuntimeStatus();
  if (!status.ready) {
    return Response.json(status, { status: 503 });
  }

  const query = parseStatementQuery(new URL(request.url));
  if (query.scope === "authorization") {
    if (!query.authorizationId || !validateAuthorizationId(query.authorizationId)) {
      return Response.json({ error: "invalid_authorization_id" }, { status: 400 });
    }
  }

  try {
    return Response.json(await buildCardStatement(query));
  } catch (error) {
    const message = error instanceof Error ? error.message : "statement_unavailable";
    if (message.startsWith("Card runtime missing")) {
      return Response.json({ error: message }, { status: 503 });
    }
    return Response.json({ error: "statement_unavailable" }, { status: 502 });
  }
}
