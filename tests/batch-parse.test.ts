import { describe, it, expect } from "vitest";
import { validateAndParseAddress } from "starknet";
import { parsePastedRecipients } from "@/app/components/Panels/SendPanel";
import { toBaseUnits } from "@/app/components/lib/format";

// Real mainnet token contracts: public constants, valid felt252 addresses.
const STRK = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";
const USDC = "0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb";

describe("parsePastedRecipients: valid lists", () => {
  it("parses an 18-decimal list into rows with correct base units", () => {
    const result = parsePastedRecipients(`${STRK},2.5\n${USDC},0.000000000000000001`, 18);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].recipient).toBe(validateAndParseAddress(STRK));
    expect(result.rows[1].recipient).toBe(validateAndParseAddress(USDC));
    expect(toBaseUnits(result.rows[0].amount, 18)).toBe(2_500_000_000_000_000_000n);
    expect(toBaseUnits(result.rows[1].amount, 18)).toBe(1n);
  });

  it("parses a 6-decimal list into rows with correct base units", () => {
    const result = parsePastedRecipients(`${STRK},12.5\n${USDC},0.5`, 6);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(toBaseUnits(result.rows[0].amount, 6)).toBe(12_500_000n);
    expect(toBaseUnits(result.rows[1].amount, 6)).toBe(500_000n);
  });

  it("normalizes short and mixed-case addresses to the padded lowercase form", () => {
    const result = parsePastedRecipients(`0X123,4`, 18);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].recipient).toBe(
      "0x0000000000000000000000000000000000000000000000000000000000000123",
    );
  });
});

describe("parsePastedRecipients: every bad line reported at once", () => {
  const badList = [
    "sneaky,1", // line 1: not a Starknet address
    `${STRK},abc`, // line 2: not an amount
    STRK, // line 3: missing comma
    ",5", // line 4: empty address
    `${STRK},`, // line 5: empty amount
    `${STRK},0`, // line 6: zero amount
  ].join("\n");

  it("collects all six problems in one pass instead of throwing on the first", () => {
    const result = parsePastedRecipients(badList, 18);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(6);
    result.errors.forEach((error, i) => {
      expect(error.startsWith(`Line ${i + 1}:`)).toBe(true);
    });
  });

  it("says what is wrong with each line", () => {
    const result = parsePastedRecipients(badList, 18);
    expect(!result.ok).toBe(true);
    if (result.ok) return;
    expect(result.errors[0]).toMatch(/not a valid Starknet address/);
    expect(result.errors[1]).toMatch(/Enter a valid amount/);
    expect(result.errors[2]).toMatch(/expected "address,amount"/);
    expect(result.errors[5]).toMatch(/greater than zero/);
  });

  it("reports a good line sandwiched between bad ones without accepting the batch", () => {
    const result = parsePastedRecipients(`${STRK},abc\n${USDC},7\n${STRK},0`, 18);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toMatch(/Line 1:/);
    expect(result.errors[1]).toMatch(/Line 3:/);
  });

  it("rejects an empty paste with guidance instead of an empty batch", () => {
    const result = parsePastedRecipients("", 18);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatch(/Paste at least one line/);
  });
});

describe("parsePastedRecipients: duplicate addresses", () => {
  it("rejects a repeated address and names the earlier line", () => {
    const result = parsePastedRecipients(`${STRK},25\n${USDC},1\n${STRK},99`, 18);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/Line 3:/);
    expect(result.errors[0]).toMatch(/line 1/);
  });

  it("catches duplicates across case differences", () => {
    const shouty = `0x${STRK.slice(2).toUpperCase()}`;
    const result = parsePastedRecipients(`${STRK},25\n${USDC},1\n${shouty},5`, 18);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatch(/Line 3:/);
    expect(result.errors[0]).toMatch(/line 1/);
  });

  it("reports every duplicate, each pointing at its own earlier line", () => {
    const result = parsePastedRecipients(`${STRK},25\n${USDC},1\n${USDC},1\n${USDC},2`, 18);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toMatch(/Line 3:/);
    expect(result.errors[0]).toMatch(/line 2/);
    expect(result.errors[1]).toMatch(/Line 4:/);
    expect(result.errors[1]).toMatch(/line 2/);
  });

  it("rejects a duplicate even when the repeated row has a broken amount", () => {
    const result = parsePastedRecipients(`${STRK},25\n${STRK},notanumber`, 18);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatch(/Line 2:/);
    expect(result.errors[0]).toMatch(/Enter a valid amount/);
  });
});

describe("parsePastedRecipients: blank lines and # comments", () => {
  it("skips them but keeps their line numbers honest in error reports", () => {
    const text = [
      "# payroll run, week 34",
      "",
      `${STRK},2.5`,
      "   ",
      "# next person",
      "sneaky,9",
      "",
      `${USDC},0.5`,
    ].join("\n");
    const result = parsePastedRecipients(text, 18);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/Line 6:/);
    expect(result.errors[0]).toMatch(/not a valid Starknet address/);
  });

  it("parses only the real rows out of a commented, blank-lined paste", () => {
    const text = [
      "# address,amount",
      `${STRK},2.5`,
      "",
      "   # indented comment still skipped",
      `${USDC},1.25`,
      "# trailing note",
    ].join("\n");
    const result = parsePastedRecipients(text, 18);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].recipient).toBe(validateAndParseAddress(STRK));
    expect(result.rows[1].recipient).toBe(validateAndParseAddress(USDC));
    expect(toBaseUnits(result.rows[1].amount, 18)).toBe(1_250_000_000_000_000_000n);
  });
});
