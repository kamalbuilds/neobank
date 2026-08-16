import { describe, it, expect } from "vitest";
import { sameAddress } from "./address";

describe("sameAddress", () => {
  it("matches the same address in different hex casing", () => {
    expect(sameAddress("0xABC", "0xabc")).toBe(true);
  });

  it("matches a zero-padded address against a short one", () => {
    expect(sameAddress("0x0000000000000000000000000000000000000000000000000000000000000abc", "0xabc")).toBe(true);
  });

  it("does not match different addresses", () => {
    expect(sameAddress("0xabc", "0xabd")).toBe(false);
  });

  it("returns false instead of throwing on an unparseable value", () => {
    expect(sameAddress("not-a-number", "0xabc")).toBe(false);
  });

  it("returns false when both sides are unparseable", () => {
    expect(sameAddress("nope", "also-nope")).toBe(false);
  });
});
