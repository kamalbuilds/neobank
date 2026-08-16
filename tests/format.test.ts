import { describe, it, expect } from "vitest";
import { fromBaseUnits, toBaseUnits } from "@/app/components/lib/format";

describe("toBaseUnits / fromBaseUnits round-trip", () => {
  it("round-trips a 6-decimal USDC amount", () => {
    const units = toBaseUnits("12.5", 6);
    expect(units).toBe(12_500_000n);
    expect(fromBaseUnits(units, 6)).toBe("12.5");
  });

  it("round-trips an 18-decimal STRK amount", () => {
    const units = toBaseUnits("1.000000000000000001", 18);
    expect(units).toBe(1_000000000000000001n);
    expect(fromBaseUnits(units, 18)).toBe("1.000000000000000001");
  });

  it("round-trips a whole-number amount with no fraction", () => {
    const units = toBaseUnits("42", 6);
    expect(units).toBe(42_000_000n);
    expect(fromBaseUnits(units, 6)).toBe("42");
  });

  it("drops trailing zero fraction on format", () => {
    expect(fromBaseUnits(10_000_000n, 6)).toBe("10");
    expect(fromBaseUnits(10_500_000n, 6)).toBe("10.5");
  });

  it("formats a negative amount with a leading minus", () => {
    expect(fromBaseUnits(-1_500_000n, 6)).toBe("-1.5");
  });
});

describe("toBaseUnits rejects junk", () => {
  it("rejects empty input", () => {
    expect(() => toBaseUnits("", 6)).toThrow("Enter an amount.");
  });

  it("rejects a lone decimal point", () => {
    expect(() => toBaseUnits(".", 6)).toThrow("Enter an amount.");
  });

  it("rejects non-numeric input", () => {
    expect(() => toBaseUnits("abc", 6)).toThrow("Enter a valid amount.");
  });

  it("rejects negative numbers", () => {
    expect(() => toBaseUnits("-5", 6)).toThrow("Enter a valid amount.");
  });

  it("rejects too many decimal places for the token", () => {
    expect(() => toBaseUnits("1.0000001", 6)).toThrow(/Too many decimal places/);
  });

  it("rejects zero amount", () => {
    expect(() => toBaseUnits("0", 6)).toThrow("Amount must be greater than zero.");
  });

  it("rejects a value that reduces to zero", () => {
    expect(() => toBaseUnits("0.0000000", 8)).toThrow("Amount must be greater than zero.");
  });
});
