import { TOKENS, type TokenSymbol } from "@/utils/constants";

export interface PaymentRequest {
  recipient: string;
  token: TokenSymbol;
  units: bigint;
  memo?: string;
  expiresAt?: number;
}

export type DecodeResult =
  | { ok: true; request: PaymentRequest }
  | { ok: false; error: string };

const VERSION = 1;

const TOKEN_IDS: Record<TokenSymbol, number> = { STRK: 1, USDC: 2 };
const ID_TOKENS: Record<number, TokenSymbol> = { 1: "STRK", 2: "USDC" };

const MAX_RECIPIENT_BYTES = 32;
const MAX_UNITS_BYTES = 16;
const MAX_AMOUNT_DIGITS = 36;
const MAX_MEMO_CHARS = 60;
const MAX_MEMO_BYTES = 120;
const MAX_EXPIRY_SECONDS = 2n ** 48n;
const CHECKSUM_BYTES = 4;
const MIN_PAYLOAD_BYTES =
  1 + 1 + 1 + 8 + 1 + 1 + CHECKSUM_BYTES;

const DAMAGED =
  "This payment request link is damaged or incomplete. Ask the payee for a fresh link.";

const B64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const B64_REV: Record<string, number> = {};
for (let i = 0; i < B64_ALPHABET.length; i++) B64_REV[B64_ALPHABET[i]] = i;

function toBase64Url(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n =
      (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64_ALPHABET[(n >>> 18) & 63] + B64_ALPHABET[(n >>> 12) & 63];
    if (i + 1 < bytes.length) out += B64_ALPHABET[(n >>> 6) & 63];
    if (i + 2 < bytes.length) out += B64_ALPHABET[n & 63];
  }
  return out;
}

function fromBase64Url(text: string): Uint8Array | null {
  if (text.length === 0 || text.length % 4 === 1) return null;
  if (/[^A-Za-z0-9\-_]/.test(text)) return null;
  const out = new Uint8Array(Math.floor((text.length * 3) / 4));
  let acc = 0;
  let bits = 0;
  let o = 0;
  for (let i = 0; i < text.length; i++) {
    acc = (acc << 6) | B64_REV[text[i]];
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >>> bits) & 0xff;
    }
  }
  return out.subarray(0, o);
}

function fnv1a32(bytes: Uint8Array): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function readU32be(bytes: Uint8Array, off: number): number {
  return (
    ((bytes[off] << 24) |
      (bytes[off + 1] << 16) |
      (bytes[off + 2] << 8) |
      bytes[off + 3]) >>>
    0
  );
}

function bigintFromBe(bytes: Uint8Array): bigint {
  let v = 0n;
  for (let i = 0; i < bytes.length; i++) v = (v << 8n) | BigInt(bytes[i]);
  return v;
}

function magnitudeBytes(value: bigint): Uint8Array {
  let hex = value.toString(16);
  if (hex.length % 2 === 1) hex = "0" + hex;
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16));
  }
  let start = 0;
  while (start < bytes.length - 1 && bytes[start] === 0) start++;
  return Uint8Array.from(bytes.slice(start));
}

export function normalizeStarknetAddress(address: string): string {
  if (!/^0x[0-9a-fA-F]+$/.test(address.trim())) {
    throw new Error("Enter a valid Starknet address.");
  }
  const value = BigInt(address.trim());
  if (value <= 0n || value >= 2n ** 251n) {
    throw new Error("Enter a valid Starknet address.");
  }
  return "0x" + value.toString(16).padStart(64, "0");
}

function validateMemo(memo: string | undefined): string | undefined {
  const trimmed = memo?.trim();
  if (!trimmed) return undefined;
  const chars = [...trimmed].length;
  if (chars > MAX_MEMO_CHARS) {
    throw new Error(`Keep the label under ${MAX_MEMO_CHARS} characters.`);
  }
  const bytes = new TextEncoder().encode(trimmed).length;
  if (bytes > MAX_MEMO_BYTES) {
    throw new Error("The label is too long to fit in a payment request link.");
  }
  return trimmed;
}

function validateExpiry(expiresAt: number | undefined): bigint {
  if (expiresAt === undefined) return 0n;
  if (!Number.isInteger(expiresAt) || expiresAt < 0) {
    throw new Error("Expiry must be a whole number of seconds.");
  }
  const value = BigInt(expiresAt);
  if (value >= MAX_EXPIRY_SECONDS) {
    throw new Error("Expiry is too far in the future.");
  }
  return value;
}

function encodeBody(req: PaymentRequest): Uint8Array {
  const recipient = normalizeStarknetAddress(req.recipient);
  const recBytes = magnitudeBytes(BigInt(recipient));
  if (recBytes.length > MAX_RECIPIENT_BYTES) {
    throw new Error("Enter a valid Starknet address.");
  }
  const tokenByte = TOKEN_IDS[req.token];
  if (tokenByte === undefined) {
    throw new Error(`Unsupported token: ${req.token}`);
  }
  if (typeof req.units !== "bigint" || req.units <= 0n) {
    throw new Error("Amount must be greater than zero.");
  }
  if (req.units.toString().length > MAX_AMOUNT_DIGITS) {
    throw new Error("Amount is too large for a payment request link.");
  }
  const unitsBytes = magnitudeBytes(req.units);
  if (unitsBytes.length > MAX_UNITS_BYTES) {
    throw new Error("Amount is too large for a payment request link.");
  }
  const expiry = validateExpiry(req.expiresAt);
  const memo = validateMemo(req.memo);
  const memoBytes = memo === undefined ? new Uint8Array(0) : new TextEncoder().encode(memo);

  const chunks: number[] = [VERSION, tokenByte, recBytes.length, ...recBytes];
  for (let shift = 56n; shift >= 0n; shift -= 8n) {
    chunks.push(Number((expiry >> shift) & 0xffn));
  }
  chunks.push(unitsBytes.length, ...unitsBytes);
  chunks.push(memoBytes.length, ...memoBytes);

  const body = Uint8Array.from(chunks);
  const out = new Uint8Array(body.length + CHECKSUM_BYTES);
  out.set(body, 0);
  const sum = fnv1a32(body);
  out[body.length] = (sum >>> 24) & 0xff;
  out[body.length + 1] = (sum >>> 16) & 0xff;
  out[body.length + 2] = (sum >>> 8) & 0xff;
  out[body.length + 3] = sum & 0xff;
  return out;
}

export function encodePaymentRequest(req: PaymentRequest): string {
  return toBase64Url(encodeBody(req));
}

export function decodePaymentRequest(payload: string): DecodeResult {
  try {
    const bytes = fromBase64Url(payload.trim());
    if (!bytes || bytes.length < MIN_PAYLOAD_BYTES) {
      return { ok: false, error: DAMAGED };
    }
    const body = bytes.subarray(0, bytes.length - CHECKSUM_BYTES);
    if (fnv1a32(body) !== readU32be(bytes, bytes.length - CHECKSUM_BYTES)) {
      return { ok: false, error: DAMAGED };
    }

    let pos = 0;
    const take = (n: number): Uint8Array | null => {
      if (pos + n > body.length) return null;
      const slice = body.subarray(pos, pos + n);
      pos += n;
      return slice;
    };

    if (body[pos++] !== VERSION) return { ok: false, error: DAMAGED };
    const token = ID_TOKENS[body[pos++]];
    if (!token) return { ok: false, error: DAMAGED };

    const lRec = body[pos++];
    if (lRec < 1 || lRec > MAX_RECIPIENT_BYTES) return { ok: false, error: DAMAGED };
    const recBytes = take(lRec);
    if (!recBytes) return { ok: false, error: DAMAGED };
    const recipient = normalizeStarknetAddress(
      "0x" + bigintFromBe(recBytes).toString(16),
    );

    const expBytes = take(8);
    if (!expBytes) return { ok: false, error: DAMAGED };
    const expiryRaw = bigintFromBe(expBytes);
    if (expiryRaw >= MAX_EXPIRY_SECONDS) return { ok: false, error: DAMAGED };
    const expiresAt = expiryRaw === 0n ? undefined : Number(expiryRaw);

    const lUnits = body[pos++];
    if (lUnits < 1 || lUnits > MAX_UNITS_BYTES) return { ok: false, error: DAMAGED };
    const unitsBytes = take(lUnits);
    if (!unitsBytes) return { ok: false, error: DAMAGED };
    const units = bigintFromBe(unitsBytes);
    if (units <= 0n) return { ok: false, error: DAMAGED };

    const lMemo = body[pos++];
    if (lMemo > MAX_MEMO_BYTES) return { ok: false, error: DAMAGED };
    const memoBytes = take(lMemo);
    if (!memoBytes) return { ok: false, error: DAMAGED };
    let memo: string | undefined;
    if (lMemo > 0) {
      memo = new TextDecoder().decode(memoBytes);
      if ([...memo].length > MAX_MEMO_CHARS) return { ok: false, error: DAMAGED };
    }

    if (pos !== body.length) return { ok: false, error: DAMAGED };

    const request: PaymentRequest = { recipient, token, units };
    if (memo !== undefined) request.memo = memo;
    if (expiresAt !== undefined) request.expiresAt = expiresAt;
    return { ok: true, request };
  } catch {
    return { ok: false, error: DAMAGED };
  }
}

export function isExpired(req: PaymentRequest, nowMs: number = Date.now()): boolean {
  return req.expiresAt !== undefined && req.expiresAt * 1000 <= nowMs;
}

export function buildPaymentRequestUrl(baseUrl: string, req: PaymentRequest): string {
  const url = new URL(baseUrl);
  url.searchParams.set("tab", "send");
  url.searchParams.set("to", normalizeStarknetAddress(req.recipient));
  url.searchParams.set("pr", encodePaymentRequest(req));
  return url.toString();
}

export function readPaymentRequest(search: string): DecodeResult | null {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  const payload = params.get("pr");
  if (!payload) return null;
  return decodePaymentRequest(payload);
}
