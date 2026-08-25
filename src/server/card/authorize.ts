import {
  cardPolicyFromEnv,
  evaluateCardPolicy,
  parseStripeAuthorization,
  verifyStripeSignature,
  type CardAuthorization,
} from "./authorization.ts";
import {
  cardRuntimeStatus,
  executeHostedCardSettlement,
  parseCardRuntimeConfig,
  type CardSettlementResult,
} from "./runtime.ts";
import { readAuthorizationStatus, type AuthorizationStatus } from "./status.ts";

type Environment = Readonly<Record<string, string | undefined>>;

type Scheduler = (work: () => void | Promise<void>) => void;

export type AuthorizeHandlerResult = {
  httpStatus: number;
  body: Record<string, unknown>;
};

type SettleFn = (
  authorization: CardAuthorization,
  env?: Environment,
) => Promise<CardSettlementResult>;

type StatusFn = (
  authorizationId: string,
  options?: { env?: Environment },
) => Promise<AuthorizationStatus>;

const inflight = new Map<string, Promise<CardSettlementResult>>();

function settleOnce(
  authorization: CardAuthorization,
  env: Environment,
  settle: SettleFn,
): Promise<CardSettlementResult> {
  const existing = inflight.get(authorization.authorizationId);
  if (existing) return existing;
  const pending = settle(authorization, env).finally(() => {
    inflight.delete(authorization.authorizationId);
  });
  inflight.set(authorization.authorizationId, pending);
  return pending;
}

export async function handleCardAuthorization(args: {
  rawBody: string;
  signatureHeader: string | null;
  waitForSettlement: boolean;
  env?: Environment;
  nowMs?: number;
  settle?: SettleFn;
  readStatus?: StatusFn;
  schedule?: Scheduler;
}): Promise<AuthorizeHandlerResult> {
  const env = args.env || process.env;
  const runtime = cardRuntimeStatus(env);
  if (!runtime.ready) {
    return { httpStatus: 503, body: runtime };
  }

  const config = parseCardRuntimeConfig(env);
  if (
    !verifyStripeSignature(
      args.rawBody,
      args.signatureHeader,
      config.webhookSecret,
      args.nowMs,
    )
  ) {
    return {
      httpStatus: 401,
      body: { approved: false, reason: "invalid_signature" },
    };
  }

  let authorization: CardAuthorization;
  try {
    authorization = parseStripeAuthorization(args.rawBody);
  } catch (error) {
    return {
      httpStatus: 400,
      body: {
        approved: false,
        reason:
          error instanceof Error ? error.message : "invalid_authorization",
      },
    };
  }

  const readStatus = args.readStatus || readAuthorizationStatus;
  const existing = await readStatus(authorization.authorizationId, { env }).catch(
    () => undefined,
  );
  if (existing?.settled) {
    return {
      httpStatus: 200,
      body: {
        approved: true,
        authorizationId: authorization.authorizationId,
        settlementStatus: "confirmed",
        settlement: existing,
      },
    };
  }

  const decision = evaluateCardPolicy(authorization, cardPolicyFromEnv(env));
  if (!decision.approved) {
    return { httpStatus: 200, body: decision };
  }

  const settle = args.settle || executeHostedCardSettlement;
  if (args.waitForSettlement) {
    const settlement = await settleOnce(authorization, env, settle);
    return {
      httpStatus: 200,
      body: { approved: true, settlementStatus: "confirmed", settlement },
    };
  }

  const schedule =
    args.schedule ||
    (await import("next/server")).after;
  schedule(async () => {
    try {
      await settleOnce(authorization, env, settle);
    } catch (error) {
      console.error("Card settlement failed", {
        authorizationId: authorization.authorizationId,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  return {
    httpStatus: 202,
    body: {
      approved: true,
      authorizationId: authorization.authorizationId,
      settlementStatus: "queued",
    },
  };
}
