import { cardRuntimeStatus } from "@/server/card/runtime";
import {
  buildCardStatement,
  buildProofBundle,
  parseStatementQuery,
  renderProofText,
} from "@/server/card/statement";
import { validateAuthorizationId } from "@/server/card/status";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const status = cardRuntimeStatus();
  if (!status.ready) {
    return Response.json(status, { status: 503 });
  }

  const query = parseStatementQuery(new URL(request.url));
  const wantsProof = query.view === "proof";
  if ((query.scope === "authorization" || wantsProof) && query.authorizationId) {
    if (!validateAuthorizationId(query.authorizationId)) {
      return Response.json({ error: "invalid_authorization_id" }, { status: 400 });
    }
  }
  if (wantsProof && !query.authorizationId) {
    return Response.json({ error: "invalid_authorization_id" }, { status: 400 });
  }

  try {
    // Proof view: a viewer-scoped bundle for exactly one authorization. An
    // unknown id is a 404 that names nothing else, so a probing caller learns
    // no global totals.
    if (wantsProof) {
      const bundle = await buildProofBundle(query.authorizationId!);
      if (!bundle) {
        return Response.json({ error: "not_found" }, { status: 404 });
      }
      const format = query.format === "text" ? "text" : "json";
      if (format === "text") {
        return new Response(renderProofText(bundle), {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "no-store",
          },
        });
      }
      return Response.json(bundle);
    }

    return Response.json(await buildCardStatement(query));
  } catch (error) {
    const message = error instanceof Error ? error.message : "statement_unavailable";
    if (message.startsWith("Card runtime missing")) {
      return Response.json({ error: message }, { status: 503 });
    }
    return Response.json({ error: "statement_unavailable" }, { status: 502 });
  }
}
