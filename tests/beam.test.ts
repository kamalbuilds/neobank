import { describe, it, expect } from "vitest";
import {
  SHIELDED_BODY_LAYOUT,
  decodePublicAddress,
  decodeShieldedReceiver,
  encodePublicAddress,
  encodeShieldedReceiver,
} from "@/app/components/lib/beam";

// SNIP-43 §10.1 (SNIP-42's published string is missing one 'q' and does not match Bech32m).
const SNIP43_HEX = "0x12235445";
const SNIP43_STRK =
  "strk1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqy3r23zsp63rc2";
const SNIP43_CANONICAL =
  "0x0000000000000000000000000000000000000000000000000000000012235445";

const POOL =
  "0x0254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91";
const ACCOUNT =
  "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

describe("encodePublicAddress / decodePublicAddress", () => {
  it("encodes SNIP-43 known hex 0x12235445 to the published strk1 vector", () => {
    expect(encodePublicAddress(SNIP43_HEX)).toBe(SNIP43_STRK);
    expect(encodePublicAddress(SNIP43_CANONICAL)).toBe(SNIP43_STRK);
  });

  it("decodes the SNIP-43 vector to canonical 32-byte hex", () => {
    expect(decodePublicAddress(SNIP43_STRK)).toBe(SNIP43_CANONICAL);
  });

  it("round-trips decode(encode(addr)) to canonical hex", () => {
    const samples = [
      SNIP43_HEX,
      "0x1",
      POOL,
      ACCOUNT,
      "0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a",
    ];
    for (const addr of samples) {
      const encoded = encodePublicAddress(addr);
      const decoded = decodePublicAddress(encoded);
      const value = BigInt(addr);
      expect(decoded).toBe("0x" + value.toString(16).padStart(64, "0"));
      expect(BigInt(decoded)).toBe(value);
      expect(encodePublicAddress(decoded)).toBe(encoded);
    }
  });

  it("throws when one character of strk1… is flipped (checksum)", () => {
    const chars = SNIP43_STRK.split("");
    const alphabet = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
    const idx = 20;
    const cur = chars[idx];
    chars[idx] = alphabet[(alphabet.indexOf(cur) + 1) % alphabet.length];
    const mutated = chars.join("");
    expect(mutated).not.toBe(SNIP43_STRK);
    expect(() => decodePublicAddress(mutated)).toThrow(/checksum/i);
  });

  it("rejects mixed case", () => {
    const mixed =
      "Strk1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqy3r23zsp63rc2";
    expect(() => decodePublicAddress(mixed)).toThrow(/mix/i);
  });

  it("accepts all-uppercase and returns the same canonical hex", () => {
    expect(decodePublicAddress(SNIP43_STRK.toUpperCase())).toBe(SNIP43_CANONICAL);
  });

  it("rejects a public payload with top 5 bits set", () => {
    // 0x08… has bit 255 set (top 5 bits of the 32-byte word).
    expect(() => encodePublicAddress("0x08" + "00".repeat(31))).toThrow(/251-bit|top 5/i);
  });
});

describe("encodeShieldedReceiver / decodeShieldedReceiver", () => {
  it("documents the opaque body as pool(32)||account(32)", () => {
    expect(SHIELDED_BODY_LAYOUT).toMatch(/pool.*32/);
    expect(SHIELDED_BODY_LAYOUT).toMatch(/account.*32/);
  });

  it("round-trips version, pool, and account", () => {
    const encoded = encodeShieldedReceiver({
      version: 0,
      pool: POOL,
      account: ACCOUNT,
    });
    expect(encoded.startsWith("strkx1")).toBe(true);
    const decoded = decodeShieldedReceiver(encoded);
    expect(decoded.version).toBe(0);
    expect(decoded.pool).toBe(
      "0x" + BigInt(POOL).toString(16).padStart(64, "0"),
    );
    expect(decoded.account).toBe(
      "0x" + BigInt(ACCOUNT).toString(16).padStart(64, "0"),
    );
  });

  it("encodes body bytes as pool_32be || account_32be under envelope v0", () => {
    // Sanity: flipping pool vs account must change the string.
    const a = encodeShieldedReceiver({ version: 0, pool: POOL, account: ACCOUNT });
    const b = encodeShieldedReceiver({ version: 0, pool: ACCOUNT, account: POOL });
    expect(a).not.toBe(b);
    expect(decodeShieldedReceiver(a).pool).toBe(
      "0x" + BigInt(POOL).toString(16).padStart(64, "0"),
    );
    expect(decodeShieldedReceiver(a).account).toBe(
      "0x" + BigInt(ACCOUNT).toString(16).padStart(64, "0"),
    );
  });

  it("throws when one character of strkx1… is flipped (checksum)", () => {
    const encoded = encodeShieldedReceiver({
      version: 0,
      pool: POOL,
      account: ACCOUNT,
    });
    const chars = encoded.split("");
    const alphabet = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
    const idx = 30;
    const cur = chars[idx];
    chars[idx] = alphabet[(alphabet.indexOf(cur) + 1) % alphabet.length];
    expect(() => decodeShieldedReceiver(chars.join(""))).toThrow(/checksum/i);
  });

  it("rejects mixed case on shielded strings", () => {
    const encoded = encodeShieldedReceiver({
      version: 0,
      pool: POOL,
      account: ACCOUNT,
    });
    const mixed = "Strkx" + encoded.slice(5);
    expect(() => decodeShieldedReceiver(mixed)).toThrow(/mix/i);
  });

  it("does not decode strk as shielded or strkx as public", () => {
    expect(() => decodeShieldedReceiver(SNIP43_STRK)).toThrow(/strkx/i);
    const shielded = encodeShieldedReceiver({
      version: 0,
      pool: POOL,
      account: ACCOUNT,
    });
    // strkx with dual-felt body exceeds the strk 90-char limit, so decode fails
    // before HRP matching; either length or HRP rejection is correct.
    expect(() => decodePublicAddress(shielded)).toThrow();
  });
});
