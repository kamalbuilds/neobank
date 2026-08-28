//! Server-minted, short-lived, single-use tokens gating the public /card demo
//! actions (shadow spend, JIT settlement). `isDemoAuthorizeEnabled()` alone
//! is not a real guard: it is a single env flag that must be "1" in
//! production for the demo button to work, so anyone who reads the code can
//! call the underlying routes directly and move real hosted funds. This
//! module adds a second, per-request gate that only the server can satisfy:
//! mint a token here (over a rate-limited route), consume it once, and the
//! signature + one-time-use tracking make it useless to replay or forge.
//!
//! Signed with DEMO_TOKEN_SECRET (falls back to CARD_WEBHOOK_SECRET, which is
//! already required by the card runtime env, so no new secret is mandatory
//! to deploy). Never derived from, or dependent on, client input.

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

type Environment = Readonly<Record<string, string | undefined>>;

export class DemoTokenError extends Error {
  readonly name = "DemoTokenError";
}

/** Demo tokens are meant to be minted immediately before use. */
const DEFAULT_TTL_MS = 120_000;

export function resolveDemoTokenSecret(env: Environment = process.env): string {
  const secret = env.DEMO_TOKEN_SECRET || env.CARD_WEBHOOK_SECRET;
  if (!secret) {
    throw new DemoTokenError(
      "DEMO_TOKEN_SECRET (or CARD_WEBHOOK_SECRET) is not configured.",
    );
  }
  return secret;
}

function sign(nonce: string, expiresAt: number, secret: string): string {
  return createHmac("sha256", secret).update(`${nonce}.${expiresAt}`).digest("hex");
}

export type DemoToken = {
  token: string;
  expiresAt: number;
};

/** Mints a fresh HMAC-signed, single-use demo token. Pure aside from RNG/env read. */
export function mintDemoToken(
  env: Environment = process.env,
  ttlMs: number = DEFAULT_TTL_MS,
  nowMs: number = Date.now(),
): DemoToken {
  const secret = resolveDemoTokenSecret(env);
  const nonce = randomBytes(16).toString("hex");
  const expiresAt = nowMs + ttlMs;
  const signature = sign(nonce, expiresAt, secret);
  return { token: `${nonce}.${expiresAt}.${signature}`, expiresAt };
}

/**
 * Nonces already redeemed, mapped to their expiry so entries can be swept
 * once they age out (a replay after expiry would fail the TTL check anyway,
 * but sweeping keeps this map from growing without bound). Process-local:
 * fine for a single hosted demo instance, and never the only guard - the
 * caller must still hold CARD_DEMO_AUTHORIZE=1 and pass rate limiting.
 */
const consumedNonces = new Map<string, number>();

function sweepExpired(nowMs: number): void {
  for (const [nonce, expiresAt] of consumedNonces) {
    if (expiresAt < nowMs) consumedNonces.delete(nonce);
  }
}

const NONCE_PATTERN = /^[0-9a-f]{32}$/i;
const SIGNATURE_PATTERN = /^[0-9a-f]{64}$/i;

/**
 * Verifies signature, TTL, and single-use property of a demo token and, only
 * on success, marks its nonce spent so it can never be redeemed again. Fails
 * closed on anything malformed, unsigned, expired, or already used.
 */
export function consumeDemoToken(
  token: string | undefined,
  env: Environment = process.env,
  nowMs: number = Date.now(),
): void {
  if (!token) {
    throw new DemoTokenError("Missing demo token.");
  }
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new DemoTokenError("Malformed demo token.");
  }
  const [nonce, expiresAtRaw, signature] = parts;
  const expiresAt = Number(expiresAtRaw);
  if (!NONCE_PATTERN.test(nonce) || !Number.isFinite(expiresAt)) {
    throw new DemoTokenError("Malformed demo token.");
  }

  const secret = resolveDemoTokenSecret(env);
  const expected = Buffer.from(sign(nonce, expiresAt, secret), "hex");
  const given = Buffer.from(
    SIGNATURE_PATTERN.test(signature) ? signature : "",
    "hex",
  );
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new DemoTokenError("Invalid demo token signature.");
  }

  sweepExpired(nowMs);
  if (expiresAt < nowMs) {
    throw new DemoTokenError("Demo token expired.");
  }
  if (consumedNonces.has(nonce)) {
    throw new DemoTokenError("Demo token already used.");
  }
  consumedNonces.set(nonce, expiresAt);
}

/** Test-only: clears the in-memory replay set between test cases. */
export function _resetDemoTokenStateForTests(): void {
  consumedNonces.clear();
}
