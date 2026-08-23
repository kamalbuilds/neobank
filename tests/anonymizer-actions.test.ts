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
  const FUNDED = 5n * 10n ** 18n;
  const actions = buildProgrammableSpendActions({
    anonymizer: ANON,
    token: TOKEN,
    funded: FUNDED,
    positionAmount: 10n ** 18n,
    legs: [
      { recipient: TO, amount: 2n * 10n ** 18n },
      { recipient: ME, amount: 500n * 10n ** 15n },
    ],
    changeRecipient: ME,
    extraCalldataTail: ["0x7", "0x8"],
  });

  it("orders the legs withdraw, open-note transfer, invoke", () => {
    expect(actions.map((a) => a.type)).toEqual(["withdraw", "transfer", "invoke"]);
  });

  it("funds the contract with exactly the funded amount", () => {
    const withdraw = actions[0] as any;
    expect(BigInt(withdraw.token)).toBe(BigInt(TOKEN));
    expect(BigInt(withdraw.amount)).toBe(FUNDED);
    expect(BigInt(withdraw.recipient)).toBe(BigInt(ANON));
  });

  it("keeps OPEN a literal string so the wallet can substitute it", () => {
    const transfer = actions[1] as any;
    expect(transfer.amount).toBe("OPEN");
    expect(transfer.amount).not.toMatch(/^0x/);
    expect(BigInt(transfer.recipient)).toBe(BigInt(ME));
  });

  it("serialises the full Cairo signature: u256s split, spans length-prefixed", () => {
    const calldata = (actions[2] as any).calldata as string[];
    // token
    expect(BigInt(calldata[0])).toBe(BigInt(TOKEN));
    // funded u256 (fits in low felt)
    expect(BigInt(calldata[1])).toBe(FUNDED);
    expect(BigInt(calldata[2])).toBe(0n);
    // positionAmount u256
    expect(BigInt(calldata[3])).toBe(10n ** 18n);
    expect(BigInt(calldata[4])).toBe(0n);
    // recipients span: len, r1, r2
    expect(BigInt(calldata[5])).toBe(2n);
    expect(BigInt(calldata[6])).toBe(BigInt(TO));
    expect(BigInt(calldata[7])).toBe(BigInt(ME));
    // amounts span: len, a1.low, a1.high, a2.low, a2.high
    expect(BigInt(calldata[8])).toBe(2n);
    expect(BigInt(calldata[9])).toBe(2n * 10n ** 18n);
    expect(BigInt(calldata[11])).toBe(500n * 10n ** 15n);
    // note id placeholder stays literal for the wallet to substitute
    expect(calldata[13]).toBe("\${openNoteIds[0]}");
    // tail appended after the standard arguments
    expect(calldata.slice(-2)).toEqual(["0x7", "0x8"]);
  });

  it("splits amounts above the u128 boundary into the high felt", () => {
    const huge = 1n << 130n; // needs the high felt
    const withHuge = buildProgrammableSpendActions({
      anonymizer: ANON,
      token: TOKEN,
      funded: huge + 1n,
      legs: [{ recipient: TO, amount: 1n }],
      changeRecipient: ME,
    });
    const calldata = (withHuge[2] as any).calldata as string[];
    // funded = 2^130 + 1 -> low felt carries the +1, high felt carries 2^130 / 2^128
    expect(BigInt(calldata[1])).toBe((huge + 1n) & ((1n << 128n) - 1n));
    expect(BigInt(calldata[2])).toBe(huge >> 128n);
  });

  it("rejects zero funded and empty spends", () => {
    expect(() =>
      buildProgrammableSpendActions({
        anonymizer: ANON, token: TOKEN, funded: 0n, legs: [{ recipient: TO, amount: 1n }], changeRecipient: ME,
      }),
    ).toThrow();
    expect(() =>
      buildProgrammableSpendActions({
        anonymizer: ANON, token: TOKEN, funded: 100n, legs: [], changeRecipient: ME,
      }),
    ).toThrow();
  });
});
