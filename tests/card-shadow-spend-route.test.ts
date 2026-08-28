import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const executeShadowSpendMock = vi.fn();

vi.mock("@/server/card/runtime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/card/runtime")>();
  return {
    ...actual,
    cardRuntimeStatus: () => ({
      ready: true,
      missing: [],
      network: "sepolia" as const,
      accountAddress: "0xhosted",
      poolAddress: "0xpool",
    }),
  };
});

vi.mock("@/server/card/shadow-spend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/card/shadow-spend")>();
  return {
    ...actual,
    // Mocked so the route guard test never touches the chain or spends real
    // funds; only the guard in front of it is under test here.
    executeShadowSpend: (...args: Parameters<typeof actual.executeShadowSpend>) =>
      executeShadowSpendMock(...args),
  };
});

import { POST } from "@/app/api/card/shadow-spend/route";
import { _resetDemoTokenStateForTests, mintDemoToken } from "@/server/card/demo-token";

const ORIGINAL_ENV = { ...process.env };

function jsonRequest(body: unknown, ip: string): Request {
  return new Request("http://localhost/api/card/shadow-spend", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

describe("POST /api/card/shadow-spend guard", () => {
  beforeEach(() => {
    process.env.CARD_DEMO_AUTHORIZE = "1";
    process.env.DEMO_TOKEN_SECRET = "route-test-demo-secret";
    executeShadowSpendMock.mockReset();
    executeShadowSpendMock.mockResolvedValue({
      transactionHash: "0xfeedfeed",
      finalityStatus: "ACCEPTED_ON_L2",
      executionStatus: "SUCCEEDED",
      shadowAddress: "0xshadow",
      shadowNonce: "0",
      commitment: "0xcommit",
      anonymizer: "0xanon",
      dappName: "neobank-card",
      amount: "100000000000000000",
      funded: "100000000000000001",
      recipient: "0xserver-configured-recipient",
      token: "0xstrk",
      warnings: [],
    });
    _resetDemoTokenStateForTests();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("rejects a request with no demo token before touching executeShadowSpend", async () => {
    const res = await POST(jsonRequest({ amountStrk: "0.1" }, "203.0.113.10"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/token/i);
    expect(executeShadowSpendMock).not.toHaveBeenCalled();
  });

  it("rejects a garbage demo token", async () => {
    const res = await POST(
      jsonRequest({ amountStrk: "0.1", demoToken: "garbage" }, "203.0.113.11"),
    );
    expect(res.status).toBe(401);
    expect(executeShadowSpendMock).not.toHaveBeenCalled();
  });

  it("accepts a request carrying a freshly minted, valid demo token", async () => {
    const { token } = mintDemoToken();
    const res = await POST(
      jsonRequest({ amountStrk: "0.1", demoToken: token }, "203.0.113.12"),
    );
    expect(res.status).toBe(200);
    expect(executeShadowSpendMock).toHaveBeenCalledTimes(1);
  });

  it("rejects the same token replayed on a second call", async () => {
    const { token } = mintDemoToken();
    const first = await POST(
      jsonRequest({ amountStrk: "0.1", demoToken: token }, "203.0.113.13"),
    );
    expect(first.status).toBe(200);

    const second = await POST(
      jsonRequest({ amountStrk: "0.1", demoToken: token }, "203.0.113.14"),
    );
    expect(second.status).toBe(401);
    const body = await second.json();
    expect(body.error).toMatch(/already used/i);
    expect(executeShadowSpendMock).toHaveBeenCalledTimes(1);
  });

  it("never forwards a client-supplied recipient to executeShadowSpend", async () => {
    const { token } = mintDemoToken();
    await POST(
      jsonRequest(
        { amountStrk: "0.1", demoToken: token, recipient: "0xattacker-controlled" },
        "203.0.113.15",
      ),
    );
    expect(executeShadowSpendMock).toHaveBeenCalledTimes(1);
    const forwarded = executeShadowSpendMock.mock.calls[0][0];
    expect(forwarded).not.toHaveProperty("recipient");
    expect(
      JSON.stringify(forwarded, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    ).not.toMatch(/attacker/);
  });

  it("still rejects when CARD_DEMO_AUTHORIZE is off, even with a valid token", async () => {
    process.env.CARD_DEMO_AUTHORIZE = "0";
    const { token } = mintDemoToken();
    const res = await POST(
      jsonRequest({ amountStrk: "0.1", demoToken: token }, "203.0.113.16"),
    );
    expect(res.status).toBe(403);
    expect(executeShadowSpendMock).not.toHaveBeenCalled();
  });

  it("rate limits after repeated calls from the same IP", async () => {
    const ip = "203.0.113.200";
    let lastStatus = 0;
    for (let i = 0; i < 11; i += 1) {
      const { token } = mintDemoToken();
      const res = await POST(jsonRequest({ amountStrk: "0.1", demoToken: token }, ip));
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});
