import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DemoTokenError,
  _resetDemoTokenStateForTests,
  consumeDemoToken,
  mintDemoToken,
  resolveDemoTokenSecret,
} from "@/server/card/demo-token";

const ENV = { DEMO_TOKEN_SECRET: "test-demo-token-secret-do-not-use-in-prod" };

describe("demo token guard", () => {
  beforeEach(() => {
    _resetDemoTokenStateForTests();
  });

  it("resolves DEMO_TOKEN_SECRET, falling back to CARD_WEBHOOK_SECRET", () => {
    expect(resolveDemoTokenSecret({ DEMO_TOKEN_SECRET: "a" })).toBe("a");
    expect(resolveDemoTokenSecret({ CARD_WEBHOOK_SECRET: "b" })).toBe("b");
    expect(resolveDemoTokenSecret({ DEMO_TOKEN_SECRET: "a", CARD_WEBHOOK_SECRET: "b" })).toBe(
      "a",
    );
    expect(() => resolveDemoTokenSecret({})).toThrow(DemoTokenError);
  });

  it("mints a token that consumes cleanly exactly once", () => {
    const { token, expiresAt } = mintDemoToken(ENV);
    expect(token.split(".")).toHaveLength(3);
    expect(expiresAt).toBeGreaterThan(Date.now());
    expect(() => consumeDemoToken(token, ENV)).not.toThrow();
  });

  it("rejects a replayed token", () => {
    const { token } = mintDemoToken(ENV);
    consumeDemoToken(token, ENV);
    expect(() => consumeDemoToken(token, ENV)).toThrow(/already used/i);
  });

  it("rejects a missing token", () => {
    expect(() => consumeDemoToken(undefined, ENV)).toThrow(/missing/i);
    expect(() => consumeDemoToken("", ENV)).toThrow(/missing/i);
  });

  it("rejects a malformed token", () => {
    expect(() => consumeDemoToken("not-a-token", ENV)).toThrow(/malformed/i);
    expect(() => consumeDemoToken("a.b", ENV)).toThrow(/malformed/i);
    expect(() => consumeDemoToken("zz.123.abc", ENV)).toThrow(/malformed/i);
  });

  it("rejects an expired token even with a correct signature", () => {
    const nowMs = 1_800_000_000_000;
    const { token } = mintDemoToken(ENV, 1_000, nowMs);
    expect(() => consumeDemoToken(token, ENV, nowMs + 1_001)).toThrow(/expired/i);
  });

  it("rejects a token signed with the wrong secret", () => {
    const { token } = mintDemoToken({ DEMO_TOKEN_SECRET: "right-secret" });
    expect(() => consumeDemoToken(token, { DEMO_TOKEN_SECRET: "wrong-secret" })).toThrow(
      /signature/i,
    );
  });

  it("rejects a tampered nonce or expiry even though the original signature is untouched", () => {
    const { token } = mintDemoToken(ENV);
    const [nonce, expiresAt, signature] = token.split(".");
    // Attacker tries to extend their own token's life without the secret.
    const forgedExpiry = `${nonce}.${Number(expiresAt) + 10_000_000}.${signature}`;
    expect(() => consumeDemoToken(forgedExpiry, ENV)).toThrow(/signature/i);
    // Attacker tries to reuse someone else's signature under a fresh nonce.
    const forgedNonce = `${"a".repeat(32)}.${expiresAt}.${signature}`;
    expect(() => consumeDemoToken(forgedNonce, ENV)).toThrow(/signature/i);
  });

  it("mints independent, unlinkable tokens across calls", () => {
    const a = mintDemoToken(ENV);
    const b = mintDemoToken(ENV);
    expect(a.token).not.toBe(b.token);
    expect(() => consumeDemoToken(a.token, ENV)).not.toThrow();
    expect(() => consumeDemoToken(b.token, ENV)).not.toThrow();
  });
});

describe("demo token guard mutation proof", () => {
  // This test exists to prove the replay check can actually fail: it fails
  // if consumeDemoToken stops tracking used nonces (e.g. the guard is
  // deleted or the single-use map is never written to).
  afterEach(() => {
    _resetDemoTokenStateForTests();
  });

  it("a second consume of the same token must be rejected, not silently accepted", () => {
    const { token } = mintDemoToken(ENV);
    consumeDemoToken(token, ENV);
    let threw = false;
    try {
      consumeDemoToken(token, ENV);
    } catch (error) {
      threw = error instanceof DemoTokenError;
    }
    expect(threw).toBe(true);
  });
});
