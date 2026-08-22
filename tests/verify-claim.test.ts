import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const SCRIPT_PATH = "../scripts/verify-strk20-claim.mjs";

const POOL = "0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a";
const POOL_UNPADDED = "0x40337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a";

type Receipt = {
  type?: string;
  execution_status?: string;
  finality_status?: string;
  events?: Array<{ from_address?: string }>;
};

function poolReceipt(fromAddress: string): Receipt {
  return {
    type: "INVOKE",
    execution_status: "SUCCEEDED",
    finality_status: "ACCEPTED_ON_L1",
    events: [{ from_address: fromAddress }],
  };
}

let workDir: string;
let originalArgv: string[];

beforeEach(async () => {
  vi.resetModules();
  workDir = await mkdtemp(path.join(tmpdir(), "verify-claim-"));
});

afterEach(async () => {
  process.argv = originalArgv;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await rm(workDir, { recursive: true, force: true });
});

async function writeClaim(transactions: string[], extras: Record<string, unknown> = {}) {
  const file = path.join(workDir, "strk20.json");
  await writeFile(file, JSON.stringify({ transactions, demo_video: "https://example.com/demo", ...extras }));
  return file;
}

async function runVerifier(file: string, receipts: Record<string, Receipt>) {
  const rpcCalls: Array<{ method: string; hash: string }> = [];
  const logs: string[] = [];

  const fetchMock = vi.fn(async (_url: string | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    rpcCalls.push({ method: body.method, hash: body.params[0] });
    return {
      ok: true,
      status: 200,
      json: async () => ({ jsonrpc: "2.0", id: 1, result: receipts[body.params[0]] ?? {} }),
    };
  });

  vi.stubGlobal("fetch", fetchMock);

  const exited = new Promise<number | undefined>((resolve) => {
    vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      resolve(code);
      return undefined as never;
    }) as typeof process.exit);
  });

  vi.spyOn(console, "log").mockImplementation((...parts: unknown[]) => {
    logs.push(parts.map(String).join(" "));
  });

  originalArgv = process.argv;
  process.argv = ["node", "scripts/verify-strk20-claim.mjs", "--json", file];

  await import(SCRIPT_PATH);
  const exitCode = await exited;

  return { exitCode, report: JSON.parse(logs.join("\n")), rpcCalls, fetchMock };
}

describe("verify-strk20-claim", () => {
  it("passes a receipt whose events include one from the pool address", async () => {
    const [h1, h2, h3] = ["0xaaa1", "0xbbb2", "0xccc3"];
    const file = await writeClaim([h1, h2, h3]);
    const { exitCode, report, rpcCalls, fetchMock } = await runVerifier(file, {
      [h1]: poolReceipt(POOL),
      [h2]: poolReceipt(POOL),
      [h3]: poolReceipt(POOL),
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);    expect(rpcCalls).toHaveLength(3);
    expect(rpcCalls.every((c) => c.method === "starknet_getTransactionReceipt")).toBe(true);
    expect(report.transactions.map((t: { pass: boolean }) => t.pass)).toEqual([true, true, true]);
    expect(report.qualifying).toBe(3);
    expect(report.scoreable).toBe(true);
    expect(exitCode).toBe(0);
  });

  it("fails a SUCCEEDED receipt that emitted no pool event", async () => {
    const deployHash = "0xddd4";
    const file = await writeClaim([deployHash]);
    const { exitCode, report } = await runVerifier(file, {
      [deployHash]: {
        type: "DEPLOY_ACCOUNT",
        execution_status: "SUCCEEDED",
        finality_status: "ACCEPTED_ON_L1",
        events: [{ from_address: "0xdeadc0de" }],
      },
    });

    expect(report.transactions[0].execution).toBe("SUCCEEDED");
    expect(report.transactions[0].pass).toBe(false);
    expect(report.transactions[0].poolEvents).toBe(0);
    expect(report.transactions[0].reason).toMatch(/no STRK20 pool event/);
    expect(report.transactions[0].reason).toContain("DEPLOY_ACCOUNT");
    expect(report.scoreable).toBe(false);
    expect(exitCode).toBe(1);
  });

  it("fails a REVERTED receipt even when the pool event fired", async () => {
    const revertedHash = "0xeee5";
    const file = await writeClaim([revertedHash]);
    const { exitCode, report } = await runVerifier(file, {
      [revertedHash]: {
        type: "INVOKE",
        execution_status: "REVERTED",
        finality_status: "ACCEPTED_ON_L1",
        events: [{ from_address: POOL }],
      },
    });

    expect(report.transactions[0].pass).toBe(false);
    expect(report.transactions[0].reason).toMatch(/execution_status is REVERTED/);
    expect(report.qualifying).toBe(0);
    expect(report.scoreable).toBe(false);
    expect(exitCode).toBe(1);
  });

  it("matches the pool address returned without leading-zero padding", async () => {
    const [h1, h2, h3] = ["0xfff6", "0x1117", "0x2228"];
    const file = await writeClaim([h1, h2, h3]);
    const { exitCode, report } = await runVerifier(file, {
      [h1]: poolReceipt(POOL),
      [h2]: poolReceipt(POOL_UNPADDED),
      [h3]: poolReceipt("0x0000040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a"),
    });

    expect(report.transactions.map((t: { pass: boolean }) => t.pass)).toEqual([true, true, true]);
    expect(report.transactions.every((t: { poolEvents: number }) => t.poolEvents === 1)).toBe(true);
    expect(report.qualifying).toBe(3);
    expect(report.scoreable).toBe(true);
    expect(exitCode).toBe(0);
  });

  it("is not scoreable with fewer than three qualifying transactions", async () => {
    const [ok1, ok2, bad] = ["0x3339", "0x444a", "0x555b"];
    const file = await writeClaim([ok1, ok2, bad]);
    const { exitCode, report } = await runVerifier(file, {
      [ok1]: poolReceipt(POOL),
      [ok2]: poolReceipt(POOL),
      [bad]: {
        type: "DEPLOY_ACCOUNT",
        execution_status: "SUCCEEDED",
        finality_status: "ACCEPTED_ON_L1",
        events: [],
      },
    });

    expect(report.qualifying).toBe(2);
    expect(report.required).toBe(3);
    expect(report.demo_video).toBe(true);
    expect(report.scoreable).toBe(false);
    expect(exitCode).toBe(1);
  });
});
