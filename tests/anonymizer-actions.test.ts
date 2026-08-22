import { describe, it, expect } from "vitest";
import { buildPayoutActions, buildProgrammableSpendActions } from "@/app/components/lib/anonymizer";

const ANON = "0x0489133ec1b184109eabff3b0058b503909a7fd2be610b95ef22d7f768fa17a6";
const TOKEN = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";
const TO = "0x0101ab74cf27f868fa42f02de17c5fca88697dd63dd850ee6626d74c25ed6a4a";
const ME = "0x0202bc85df38f979fb53f13de28d6fdb99708ee74ee961ff7737e85d36fe7b5b";

describe("buildPayoutActions", () => {
  const actions = buildPayoutActions({
    anonymizer: ANON,
    token: TOKEN,
    amount: 5n * 10n ** 18n,
    recipient: TO,
  });

  it("funds the contract with a withdraw, not a transfer", () => {
    // The bug this guards: a transfer with amount OPEN funds nothing, so the
    // contract has no balance to pay out and the call reverts.
    expect(actions[0].type).toBe("withdraw");
    expect((actions[0] as any).recipient).toBe(actions[1] && (actions[1] as any).contract);
  });

  it("invokes the anonymizer with token, recipient and amount", () => {
    const invoke = actions[1] as any;
    expect(invoke.type).toBe("invoke");
    expect(BigInt(invoke.calldata[0])).toBe(BigInt(TOKEN));
    expect(BigInt(invoke.calldata[1])).toBe(BigInt(TO));
    expect(BigInt(invoke.calldata[2])).toBe(5n * 10n ** 18n);
  });

  it("creates no open note, because the payout returns an empty span", () => {
    expect(actions.some((a) => (a as any).amount === "OPEN")).toBe(false);
    expect(actions).toHaveLength(2);
  });

  it("rejects a non-positive amount", () => {
    expect(() => buildPayoutActions({ anonymizer: ANON, token: TOKEN, amount: 0n, recipient: TO })).toThrow();
  });
});

describe("buildProgrammableSpendActions", () => {
  const actions = buildProgrammableSpendActions({
    anonymizer: ANON,
    token: TOKEN,
    amount: 5n * 10n ** 18n,
    recipient: TO,
    changeRecipient: ME,
  });

  it("orders the legs withdraw, open-note transfer, invoke", () => {
    expect(actions.map((a) => a.type)).toEqual(["withdraw", "transfer", "invoke"]);
  });

  it("keeps OPEN a literal string so the wallet can substitute it", () => {
    const transfer = actions[1] as any;
    expect(transfer.amount).toBe("OPEN");
    expect(transfer.amount).not.toMatch(/^0x/);
  });

  it("keeps the pool and note placeholders literal, never hex-normalised", () => {
    const calldata = (actions[2] as any).calldata as string[];
    expect(calldata).toContain("${poolAddress}");
    expect(calldata).toContain("${openNoteIds[0]}");
    for (const placeholder of ["${poolAddress}", "${openNoteIds[0]}"]) {
      expect(calldata.find((c) => c === placeholder)).toBeDefined();
    }
  });

  it("hex-normalises the real token, recipient and amount", () => {
    const calldata = (actions[2] as any).calldata as string[];
    expect(calldata[0]).toMatch(/^0x/);
    expect(BigInt(calldata[0])).toBe(BigInt(TOKEN));
    expect(BigInt(calldata[1])).toBe(BigInt(TO));
    expect(BigInt(calldata[2])).toBe(5n * 10n ** 18n);
  });

  it("appends extra calldata after the standard arguments", () => {
    const withExtra = buildProgrammableSpendActions({
      anonymizer: ANON,
      token: TOKEN,
      amount: 1n,
      recipient: TO,
      changeRecipient: ME,
      extraCalldata: ["0x7", "0x8"],
    });
    const calldata = (withExtra[2] as any).calldata as string[];
    expect(calldata.slice(-2)).toEqual(["0x7", "0x8"]);
  });
});
