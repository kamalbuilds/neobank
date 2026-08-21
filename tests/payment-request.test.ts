import { describe, it, expect } from "vitest";
import {
  buildPaymentRequestUrl,
  decodePaymentRequest,
  encodePaymentRequest,
  isExpired,
  normalizeStarknetAddress,
  readPaymentRequest,
  type PaymentRequest,
} from "@/app/components/lib/paymentRequest";
import { fromBaseUnits, toBaseUnits } from "@/app/components/lib/format";

const ADDR =
  "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

const base = { recipient: ADDR, token: "STRK" as const, units: 5n };

function req(overrides: Partial<PaymentRequest> = {}): PaymentRequest {
  return { ...base, ...overrides };
}

describe("encode/decode round-trip", () => {
  it("round-trips an 18-decimal STRK amount exactly", () => {
    const units = toBaseUnits("1.000000000000000001", 18);
    const payload = encodePaymentRequest(req({ units }));
    const result = decodePaymentRequest(payload);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request.units).toBe(units);
    expect(result.request.token).toBe("STRK");
    expect(result.request.recipient).toBe(ADDR);
    const human = fromBaseUnits(result.request.units, 18);
    expect(human).toBe("1.000000000000000001");
    expect(toBaseUnits(human, 18)).toBe(units);
  });

  it("round-trips a 6-decimal USDC amount exactly, down to one micro-unit", () => {
    const units = toBaseUnits("0.000001", 6);
    expect(units).toBe(1n);
    const payload = encodePaymentRequest(req({ token: "USDC", units }));
    const result = decodePaymentRequest(payload);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request.token).toBe("USDC");
    expect(result.request.units).toBe(1n);
    expect(fromBaseUnits(result.request.units, 6)).toBe("0.000001");
  });

  it("round-trips a large mixed whole-plus-fraction amount", () => {
    const units = toBaseUnits("987654321098.123456789012345678", 18);
    const payload = encodePaymentRequest(req({ units }));
    const result = decodePaymentRequest(payload);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request.units).toBe(units);
  });

  it("normalizes an unpadded address to the padded felt form", () => {
    const payload = encodePaymentRequest(
      req({ recipient: "0x4718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d" }),
    );
    const result = decodePaymentRequest(payload);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request.recipient).toBe(normalizeStarknetAddress(ADDR));
  });

  it("round-trips a unicode memo", () => {
    const payload = encodePaymentRequest(req({ memo: "Coffee ☕ for Ana" }));
    const result = decodePaymentRequest(payload);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request.memo).toBe("Coffee ☕ for Ana");
  });

  it("round-trips expiry exactly and drops empty memos", () => {
    const payload = encodePaymentRequest(req({ memo: "   ", expiresAt: 1893456000 }));
    const result = decodePaymentRequest(payload);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request.expiresAt).toBe(1893456000);
    expect(result.request.memo).toBeUndefined();
  });
});

describe("damaged payloads are rejected cleanly", () => {
  it("rejects every truncation without throwing", () => {
    const payload = encodePaymentRequest(req({ memo: "invoice", expiresAt: 1900000000 }));
    for (let cut = 1; cut <= 10; cut++) {
      const result = decodePaymentRequest(payload.slice(0, payload.length - cut));
      expect(result.ok).toBe(false);
    }
    expect(decodePaymentRequest(payload.slice(0, 12)).ok).toBe(false);
    expect(decodePaymentRequest(payload.slice(0, 1)).ok).toBe(false);
  });

  it("rejects tampered payloads without throwing", () => {
    const payload = encodePaymentRequest(req());
    const flips = [0, Math.floor(payload.length / 2), payload.length - 1];
    for (const i of flips) {
      const chars = payload.split("");
      chars[i] = chars[i] === "A" ? "z" : "A";
      const result = decodePaymentRequest(chars.join(""));
      expect(result.ok).toBe(false);
    }
  });

  it("rejects garbage inputs with a readable error", () => {
    for (const junk of ["", "not-a-request", "%%%%%", "AAAA", "===="]) {
      const result = decodePaymentRequest(junk);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/damaged or incomplete/i);
      }
    }
  });

  it("never throws across random-ish byte mutations of the tail", () => {
    const payload = encodePaymentRequest(req());
    for (let i = Math.max(0, payload.length - 8); i < payload.length; i++) {
      const chars = payload.split("");
      chars[i] = "-";
      expect(() => decodePaymentRequest(chars.join("")).ok === false).not.toThrow();
    }
  });
});

describe("expiry detection", () => {
  it("flags a request whose expiry is in the past", () => {
    const r = req({ expiresAt: 1700000000 });
    expect(isExpired(r, 1699999999999)).toBe(false);
    expect(isExpired(r, 1700000000000)).toBe(true);
    expect(isExpired(r, Date.now())).toBe(true);
  });

  it("treats a future expiry as live and no expiry as never-expiring", () => {
    expect(isExpired(req({ expiresAt: 9999999999 }), 1755000000000)).toBe(false);
    expect(isExpired(req(), 9999999999999)).toBe(false);
  });

  it("decodes the expiry so the UI can show the exact date", () => {
    const result = decodePaymentRequest(
      encodePaymentRequest(req({ token: "USDC", units: 2_500_000n, expiresAt: 1767225600 })),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(isExpired(result.request, 1767225599999)).toBe(false);
    expect(isExpired(result.request, 1767225600000)).toBe(true);
  });
});

describe("encode validation", () => {
  it("rejects invalid recipients", () => {
    expect(() => encodePaymentRequest(req({ recipient: "" }))).toThrow();
    expect(() => encodePaymentRequest(req({ recipient: "123" }))).toThrow();
    expect(() => encodePaymentRequest(req({ recipient: "0xzz" }))).toThrow();
    expect(() => encodePaymentRequest(req({ recipient: "0x0" }))).toThrow();
    expect(() =>
      encodePaymentRequest(req({ recipient: "0x" + "f".repeat(80) })),
    ).toThrow();
  });

  it("rejects unknown tokens, zero amounts, oversized amounts and long memos", () => {
    expect(() => encodePaymentRequest(req({ token: "BTC" as never }))).toThrow();
    expect(() => encodePaymentRequest(req({ units: 0n }))).toThrow();
    expect(() =>
      encodePaymentRequest(req({ units: BigInt("1" + "0".repeat(36)) })),
    ).toThrow();
    expect(() => encodePaymentRequest(req({ memo: "x".repeat(61) }))).toThrow();
  });
});

describe("URL helpers", () => {
  it("builds a short URL-safe link that reads back identically", () => {
    const original = req({
      token: "USDC",
      units: toBaseUnits("25.5", 6),
      memo: "Invoice 42",
      expiresAt: 1900000000,
    });
    const url = buildPaymentRequestUrl("https://example.test/?utm=x", original);
    const parsed = new URL(url);
    expect(parsed.searchParams.get("tab")).toBe("send");
    expect(parsed.searchParams.get("to")).toBe(normalizeStarknetAddress(ADDR));
    const payload = parsed.searchParams.get("pr") ?? "";
    expect(payload).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(payload.length).toBeLessThan(300);

    const found = readPaymentRequest(parsed.search);
    expect(found?.ok).toBe(true);
    if (found && found.ok) {
      expect(found.request).toEqual(original);
      expect(found.request.units).toBe(toBaseUnits("25.5", 6));
    }
  });

  it("returns null when there is no request param (old bare receive links)", () => {
    expect(readPaymentRequest("?tab=send&to=0xabc")).toBeNull();
    expect(readPaymentRequest("?tab=receive")).toBeNull();
  });

  it("surfaces a damaged pr param as ok:false instead of throwing", () => {
    const good = new URL(buildPaymentRequestUrl("https://example.test/", req()));
    const bad = (good.searchParams.get("pr") ?? "").slice(0, -3);
    const result = readPaymentRequest(`?pr=${bad}`);
    expect(result?.ok).toBe(false);
  });
});
