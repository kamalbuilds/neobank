import { describe, it, expect } from "vitest";
import { isStrk20Capable } from "@/app/components/lib/capability";

describe("isStrk20Capable", () => {
  it("accepts the two-part form '0.10'", () => {
    expect(isStrk20Capable(["0.10"])).toBe(true);
  });

  it("accepts a patch above the minimum '0.10.3'", () => {
    expect(isStrk20Capable(["0.10.3"])).toBe(true);
  });

  it("accepts a minor above the minimum '0.11'", () => {
    expect(isStrk20Capable(["0.11"])).toBe(true);
  });

  it("rejects a version below the minimum '0.9'", () => {
    expect(isStrk20Capable(["0.9"])).toBe(false);
  });

  it("rejects an empty list", () => {
    expect(isStrk20Capable([])).toBe(false);
  });

  it("accepts the exact minimum expressed as '0.10.0'", () => {
    expect(isStrk20Capable(["0.10.0"])).toBe(true);
  });
});
