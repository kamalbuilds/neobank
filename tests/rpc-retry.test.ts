import { describe, it, expect } from "vitest";
import { withRetry } from "@/app/components/lib/rpcRetry";

// Real timers with a 1ms base delay: exercising the actual backoff sleep path
// (setTimeout) instead of faking it, so the tests prove the real retry loop.
const FAST = { attempts: 4, baseMs: 1 };

describe("withRetry", () => {
  it("succeeds after 2 transient failures", async () => {
    let callCount = 0;
    const fn = async () => {
      callCount++;
      if (callCount < 3) {
        throw new Error("ETIMEDOUT: connection timed out");
      }
      return "success";
    };

    const result = await withRetry(fn, FAST);
    expect(result).toBe("success");
    expect(callCount).toBe(3);
  });

  it("does not retry on revert-like error", async () => {
    let callCount = 0;
    const fn = async () => {
      callCount++;
      throw new Error("REVERT: execution reverted");
    };

    await expect(withRetry(fn, FAST)).rejects.toThrow("REVERT: execution reverted");
    expect(callCount).toBe(1);
  });

  it("respects max attempts", async () => {
    let callCount = 0;
    const fn = async () => {
      callCount++;
      throw new Error("ETIMEDOUT: connection timed out");
    };

    await expect(withRetry(fn, { attempts: 2, baseMs: 1 })).rejects.toThrow();
    expect(callCount).toBe(2);
  });

  it("passes through non-transient error immediately", async () => {
    let callCount = 0;
    const fn = async () => {
      callCount++;
      throw new Error("INSUFFICIENT_PRIVATE_BALANCE: not enough funds");
    };

    await expect(withRetry(fn, FAST)).rejects.toThrow(
      "INSUFFICIENT_PRIVATE_BALANCE: not enough funds"
    );
    expect(callCount).toBe(1);
  });

  it("calls onRetry callback", async () => {
    const onRetry: { attempt: number; err: string }[] = [];
    const fn = async () => {
      throw new Error("ETIMEDOUT: connection timed out");
    };

    await expect(
      withRetry(fn, {
        attempts: 3,
        baseMs: 1,
        onRetry: (attempt, err) => onRetry.push({ attempt, err: (err as Error).message }),
      }),
    ).rejects.toThrow();
    expect(onRetry.length).toBe(2);
    expect(onRetry[0].attempt).toBe(1);
    expect(onRetry[1].attempt).toBe(2);
  });
});
