import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/fund/inbound/burn/route";

const ORIGINAL_ENV = { ...process.env };

function jsonRequest(body: unknown, ip: string): Request {
  return new Request("http://localhost/api/fund/inbound/burn", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

describe("POST /api/fund/inbound/burn rate limit", () => {
  beforeEach(() => {
    // Fails closed with 503 before ever touching the EVM signer - exactly
    // what an unauthenticated caller with no server env should see. The
    // rate limiter runs before that check, so this proves it applies even
    // when the runtime is not configured.
    delete process.env.CARD_RUNTIME_ACCOUNT_ADDRESS;
    delete process.env.CARD_RUNTIME_PRIVATE_KEY;
    delete process.env.INBOUND_EVM_PRIVATE_KEY;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("rejects the 11th call within a minute from the same IP", async () => {
    const ip = "192.0.2.50";
    const statuses: number[] = [];
    for (let i = 0; i < 11; i += 1) {
      const res = await POST(jsonRequest({ amountUnits: "1000000" }, ip));
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 10)).toEqual(Array(10).fill(503));
    expect(statuses[10]).toBe(429);
  });

  it("does not rate limit a different IP after another IP is exhausted", async () => {
    const exhausted = "192.0.2.51";
    for (let i = 0; i < 10; i += 1) {
      await POST(jsonRequest({ amountUnits: "1000000" }, exhausted));
    }
    const blocked = await POST(jsonRequest({ amountUnits: "1000000" }, exhausted));
    expect(blocked.status).toBe(429);

    const freshIp = "192.0.2.52";
    const res = await POST(jsonRequest({ amountUnits: "1000000" }, freshIp));
    expect(res.status).toBe(503); // not rate limited, just unconfigured
  });
});
