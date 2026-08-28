import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/card/demo-token/route";
import { consumeDemoToken, _resetDemoTokenStateForTests } from "@/server/card/demo-token";

const ORIGINAL_ENV = { ...process.env };

function request(ip: string): Request {
  return new Request("http://localhost/api/card/demo-token", {
    method: "POST",
    headers: { "x-forwarded-for": ip },
  });
}

describe("POST /api/card/demo-token", () => {
  beforeEach(() => {
    process.env.DEMO_TOKEN_SECRET = "mint-route-test-secret";
    _resetDemoTokenStateForTests();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("refuses to mint when the demo flag is off", async () => {
    process.env.CARD_DEMO_AUTHORIZE = "0";
    const res = await POST(request("172.16.0.10"));
    expect(res.status).toBe(403);
  });

  it("mints a token that the guard on the spend routes can consume exactly once", async () => {
    process.env.CARD_DEMO_AUTHORIZE = "1";
    const res = await POST(request("172.16.0.11"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.token).toBe("string");
    expect(consumeDemoToken(body.token)).toBeUndefined();
    expect(() => consumeDemoToken(body.token)).toThrow(/already used/i);
  });

  it("rate limits repeated minting from the same IP", async () => {
    process.env.CARD_DEMO_AUTHORIZE = "1";
    const ip = "172.16.0.200";
    let lastStatus = 0;
    for (let i = 0; i < 11; i += 1) {
      lastStatus = (await POST(request(ip))).status;
    }
    expect(lastStatus).toBe(429);
  });
});
