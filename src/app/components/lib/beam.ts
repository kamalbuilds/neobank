import { bech32m } from "bech32";

/** SNIP-42/43 public HRP (checksummed Starknet address). */
export const HRP_PUBLIC = "strk";
/** SNIP-42/43 shielded HRP (opaque versioned receiver). */
export const HRP_SHIELDED = "strkx";

const STRK_LIMIT = 90;
// Dual 32-byte felts need ~116 chars; draft SNIP-43 caps strkx at 90 for compact
// MASP receivers. Our app-local body exceeds that until MASP publishes a shorter form.
const STRKX_LIMIT = 120;

const FELT_MAX = 2n ** 251n;

export interface ShieldedReceiver {
  /** 5-bit Bech32m envelope version (SNIP v0 = 0). */
  version: number;
  pool: string;
  account: string;
}

/**
 * SNIP-43 strkx container: data = version_u5 || convertbits(body, 8→5, pad=true).
 *
 * App-local opaque body (MASP Core SNIP not published; do not treat as official Beam):
 *   body := pool (32 bytes big-endian felt252) || account (32 bytes big-endian felt252)
 * Total body length: 64 bytes.
 */
export const SHIELDED_BODY_LAYOUT =
  "pool(32-byte BE felt) || account(32-byte BE felt); envelope version is a separate 5-bit prefix";

function assertNoMixedCase(value: string): void {
  const lower = value.toLowerCase();
  const upper = value.toUpperCase();
  if (value !== lower && value !== upper) {
    throw new Error("Address must not mix uppercase and lowercase.");
  }
}

function parseFelt(hex: string, label: string): bigint {
  const trimmed = hex.trim();
  if (!/^0x[0-9a-fA-F]+$/.test(trimmed)) {
    throw new Error(`Enter a valid ${label} hex address.`);
  }
  let value: bigint;
  try {
    value = BigInt(trimmed);
  } catch {
    throw new Error(`Enter a valid ${label} hex address.`);
  }
  if (value < 0n || value >= FELT_MAX) {
    throw new Error(`${label} must be a 251-bit Starknet felt.`);
  }
  return value;
}

function feltToBytes32(value: bigint): Uint8Array {
  const hex = value.toString(16).padStart(64, "0");
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  if ((out[0] & 0xf8) !== 0) {
    throw new Error("Address top 5 bits must be zero.");
  }
  return out;
}

function bytes32ToCanonicalHex(bytes: Uint8Array): string {
  if (bytes.length !== 32) {
    throw new Error("Expected exactly 32 address bytes.");
  }
  if ((bytes[0] & 0xf8) !== 0) {
    throw new Error("Address top 5 bits must be zero.");
  }
  let hex = "";
  for (let i = 0; i < 32; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  const value = BigInt("0x" + hex);
  if (value >= FELT_MAX) {
    throw new Error("Address must be a 251-bit Starknet felt.");
  }
  return "0x" + hex;
}

function buildShieldedBody(pool: string, account: string): Uint8Array {
  const body = new Uint8Array(64);
  body.set(feltToBytes32(parseFelt(pool, "pool")), 0);
  body.set(feltToBytes32(parseFelt(account, "account")), 32);
  return body;
}

function parseShieldedBody(body: Uint8Array): { pool: string; account: string } {
  if (body.length !== 64) {
    throw new Error(
      `Shielded receiver body must be 64 bytes (pool||account); got ${body.length}.`,
    );
  }
  return {
    pool: bytes32ToCanonicalHex(body.subarray(0, 32)),
    account: bytes32ToCanonicalHex(body.subarray(32, 64)),
  };
}

/** Encode a Starknet felt as SNIP-42/43 `strk1…` Bech32m (envelope v0). */
export function encodePublicAddress(hex: string): string {
  const bytes = feltToBytes32(parseFelt(hex, "address"));
  const words = [0, ...bech32m.toWords(bytes)];
  return bech32m.encode(HRP_PUBLIC, words, STRK_LIMIT);
}

/** Decode `strk1…` to canonical `0x` + 64 lowercase hex chars. */
export function decodePublicAddress(encoded: string): string {
  const text = encoded.trim();
  assertNoMixedCase(text);
  let decoded: { prefix: string; words: number[] };
  try {
    decoded = bech32m.decode(text.toLowerCase(), STRK_LIMIT);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Invalid checksummed address.";
    throw new Error(msg);
  }
  if (decoded.prefix !== HRP_PUBLIC) {
    throw new Error(`Expected ${HRP_PUBLIC} address, got ${decoded.prefix}.`);
  }
  if (decoded.words.length < 1) {
    throw new Error("Checksummed address payload is empty.");
  }
  const version = decoded.words[0];
  if (version !== 0) {
    throw new Error(`Unsupported public address version ${version}.`);
  }
  let body: number[];
  try {
    body = bech32m.fromWords(decoded.words.slice(1));
  } catch {
    throw new Error("Checksummed address payload is malformed.");
  }
  if (body.length !== 32) {
    throw new Error(`Public address must decode to 32 bytes; got ${body.length}.`);
  }
  return bytes32ToCanonicalHex(Uint8Array.from(body));
}

/**
 * Encode a shielded receiver as SNIP-43 `strkx1…`.
 * Body bytes (documented): pool (32 BE) || account (32 BE). See SHIELDED_BODY_LAYOUT.
 */
export function encodeShieldedReceiver(receiver: ShieldedReceiver): string {
  const { version, pool, account } = receiver;
  if (!Number.isInteger(version) || version < 0 || version > 31) {
    throw new Error("Shielded receiver version must be an integer in 0..31.");
  }
  const body = buildShieldedBody(pool, account);
  const words = [version, ...bech32m.toWords(body)];
  return bech32m.encode(HRP_SHIELDED, words, STRKX_LIMIT);
}

/** Decode `strkx1…` expecting the app-local 64-byte pool||account body. */
export function decodeShieldedReceiver(encoded: string): ShieldedReceiver {
  const text = encoded.trim();
  assertNoMixedCase(text);
  let decoded: { prefix: string; words: number[] };
  try {
    decoded = bech32m.decode(text.toLowerCase(), STRKX_LIMIT);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Invalid shielded receiver string.";
    throw new Error(msg);
  }
  if (decoded.prefix !== HRP_SHIELDED) {
    throw new Error(`Expected ${HRP_SHIELDED} address, got ${decoded.prefix}.`);
  }
  if (decoded.words.length < 1) {
    throw new Error("Shielded receiver payload is empty.");
  }
  const version = decoded.words[0];
  let body: number[];
  try {
    body = bech32m.fromWords(decoded.words.slice(1));
  } catch {
    throw new Error("Shielded receiver payload is malformed.");
  }
  const { pool, account } = parseShieldedBody(Uint8Array.from(body));
  return { version, pool, account };
}
