import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const executeJitCardSettlementMock = vi.fn();

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

vi.mock("@/server/card/jit-settlement", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/card/jit-settlement")>();
  return {
    ...actual,
    // Mocked so the guard test never touches the chain or spends real funds.
    executeJitCardSettlement: (
      ...args: Parameters<typeof actual.executeJitCardSettlement>
    ) => executeJitCardSettlementMock(...args),
  };
});

import { POST } from "@/app/api/card/jit/route";
import { _resetDemoTokenStateForTests, mintDemoToken } from "@/server/card/demo-token";

const ORIGINAL_ENV = { ...process.env };

function jsonRequest(body: unknown, ip: string): Request {
  return new Request("http://localhost/api/card/jit", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

describe("POST /api/card/jit guard", () => {
  beforeEach(() => {
    process.env.CARD_DEMO_AUTHORIZE = "1";
    process.env.DEMO_TOKEN_SECRET = "route-test-demo-secret";
    executeJitCardSettlementMock.mockReset();
    executeJitCardSettlementMock.mockResolvedValue({
      authorizationId: "iauth_1",
      authorizationFelt: "0x1",
      transactionHash: "0xfeedfeed",
      finalityStatus: "ACCEPTED_ON_L2",
      executionStatus: "SUCCEEDED",
      amountInStrk: "2000000000000000000",
      quotedOut: "1189325",
      minOut: "1180000",
      paid: "1189325",
      jitConverter: "0xconverter",
      router: "0xrouter",
      soldToken: "0xstrk",
      boughtToken: "0xusdc",
      warnings: [],
    });
    _resetDemoTokenStateForTests();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  const baseBody = { authorizationId: "iauth_1", amountInStrk: "2000000000000000000" };

  it("rejects a request with no demo token before touching executeJitCardSettlement", async () => {
    const res = await POST(jsonRequest(baseBody, "198.51.100.10"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/token/i);
    expect(executeJitCardSettlementMock).not.toHaveBeenCalled();
  });

  it("accepts a request carrying a freshly minted, valid demo token", async () => {
    const { token } = mintDemoToken();
    const res = await POST(
      jsonRequest({ ...baseBody, demoToken: token }, "198.51.100.11"),
    );
    expect(res.status).toBe(200);
    expect(executeJitCardSettlementMock).toHaveBeenCalledTimes(1);
  });

  it("rejects the same token replayed on a second call", async () => {
    const { token } = mintDemoToken();
    const first = await POST(
      jsonRequest({ ...baseBody, demoToken: token }, "198.51.100.12"),
    );
    expect(first.status).toBe(200);

    const second = await POST(
      jsonRequest({ ...baseBody, demoToken: token }, "198.51.100.13"),
    );
    expect(second.status).toBe(401);
    const body = await second.json();
    expect(body.error).toMatch(/already used/i);
    expect(executeJitCardSettlementMock).toHaveBeenCalledTimes(1);
  });

  it("still rejects when CARD_DEMO_AUTHORIZE is off, even with a valid token", async () => {
    process.env.CARD_DEMO_AUTHORIZE = "0";
    const { token } = mintDemoToken();
    const res = await POST(
      jsonRequest({ ...baseBody, demoToken: token }, "198.51.100.14"),
    );
    expect(res.status).toBe(403);
    expect(executeJitCardSettlementMock).not.toHaveBeenCalled();
  });

  it("rate limits after repeated calls from the same IP", async () => {
    const ip = "198.51.100.200";
    let lastStatus = 0;
    for (let i = 0; i < 11; i += 1) {
      const { token } = mintDemoToken();
      const res = await POST(jsonRequest({ ...baseBody, demoToken: token }, ip));
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});
