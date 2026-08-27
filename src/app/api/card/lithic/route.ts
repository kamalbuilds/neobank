import { cardPolicyFromEnv, evaluateCardPolicy } from "@/server/card/authorization";
import {
  lithicResponseFor,
  parseLithicAuthorization,
  verifyLithicSignature,
} from "@/server/card/issuers/lithic";
import { cardRuntimeStatus, executeHostedCardSettlement } from "@/server/card/runtime";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Lithic Auth Stream Access (ASA) responder endpoint.
 *
 * This is the real-time, synchronous authorization decisioning webhook:
 * Lithic calls this endpoint mid-transaction (6s timeout, recommend <3s) for
 * every simulated or live authorization on cards enrolled with this
 * program, expecting `{ result: "APPROVED" | ... , token }` back.
 * https://docs.lithic.com/docs/auth-stream-access-asa
 */
export async function GET() {
  return Response.json(cardRuntimeStatus());
}

export async function POST(request: Request) {
  const env = process.env;
  const rawBody = await request.text();
  const secret = env.LITHIC_ASA_SECRET || "";

  if (!verifyLithicSignature(rawBody, request.headers, secret)) {
    return Response.json({ result: "UNAUTHORIZED_MERCHANT" }, { status: 401 });
  }

  let authorization;
  try {
    authorization = parseLithicAuthorization(rawBody);
  } catch (error) {
    return Response.json(
      {
        result: "UNAUTHORIZED_MERCHANT",
        error: error instanceof Error ? error.message : "invalid_authorization",
      },
      { status: 400 },
    );
  }

  const decision = evaluateCardPolicy(authorization, cardPolicyFromEnv(env));
  const response = lithicResponseFor(authorization.authorizationId, decision);

  if (decision.approved && cardRuntimeStatus(env).ready) {
    const schedule = (await import("next/server")).after;
    schedule(async () => {
      try {
        await executeHostedCardSettlement(authorization, env);
      } catch (error) {
        console.error("Lithic-triggered card settlement failed", {
          authorizationId: authorization.authorizationId,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });
  }

  return Response.json(response, { status: 200 });
}
