import { describe, it, expect } from "vitest";
import { classifyStrk20Error } from "@/app/components/lib/strk20";

describe("classifyStrk20Error", () => {
  it("classifies NOT_REGISTERED from a message", () => {
    const result = classifyStrk20Error({ message: "NOT_REGISTERED: address not in pool" });
    expect(result.kind).toBe("not_registered");
    expect(result.message).toMatch(/Approve the first shield/);
  });

  it("classifies NOT_REGISTERED from a code", () => {
    const result = classifyStrk20Error({ code: "NOT_REGISTERED" });
    expect(result.kind).toBe("not_registered");
  });

  it("classifies INSUFFICIENT_PRIVATE_BALANCE", () => {
    const result = classifyStrk20Error({ message: "insufficient_private_balance: short by 5" });
    expect(result.kind).toBe("insufficient_private_balance");
    expect(result.message).toBe("Not enough shielded balance to cover this amount.");
  });

  it("classifies a user rejection (REJECT)", () => {
    const result = classifyStrk20Error({ message: "User rejected the request" });
    expect(result.kind).toBe("rejected");
  });

  it("classifies a user rejection (USER_REFUSED)", () => {
    const result = classifyStrk20Error(new Error("USER_REFUSED"));
    expect(result.kind).toBe("rejected");
  });

  it("falls back to unknown for an unrecognized error", () => {
    const result = classifyStrk20Error({ message: "some unrelated wallet failure" });
    expect(result.kind).toBe("unknown");
    expect(result.message).toBe("Action failed.");
  });

  it("reads a nested baseError shape", () => {
    const result = classifyStrk20Error({ baseError: { code: "PRIVACY_LEAK", message: "would leak" } });
    expect(result.kind).toBe("privacy_leak");
  });

  it("preserves the raw message text", () => {
    const result = classifyStrk20Error({ message: "REJECT: nope" });
    expect(result.raw).toBe("REJECT: nope");
  });
});
