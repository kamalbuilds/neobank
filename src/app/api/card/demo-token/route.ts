import { enforceRateLimit, jsonError } from "@/app/api/avnu/lib";
import { isDemoAuthorizeEnabled } from "@/server/card/authorization";
import { DemoTokenError, mintDemoToken } from "@/server/card/demo-token";

export const runtime = "nodejs";

/**
 * POST /api/card/demo-token
 *
 * Mints a short-lived, single-use token the public /card demo UI attaches to
 * a shadow-spend or JIT settlement call. Gated the same way as those routes
 * (CARD_DEMO_AUTHORIZE=1, per-IP rate limit) so minting itself cannot be used
 * to bypass the guard it exists to enforce.
 */
export async function POST(request: Request) {
  if (!isDemoAuthorizeEnabled()) {
    return Response.json({ error: "demo_authorize_disabled" }, { status: 403 });
  }
  try {
    enforceRateLimit(request, "card-demo-token");
  } catch (error) {
    return jsonError(error);
  }
  try {
    const { token, expiresAt } = mintDemoToken();
    return Response.json({ token, expiresAt });
  } catch (error) {
    if (error instanceof DemoTokenError) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    throw error;
  }
}
