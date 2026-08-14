import { num } from "starknet";

// Shorten a felt/hex/address for display ("0x1dc5a1c...1927a").
export function shortHex(h: string): string {
  const hex = num.toHex(h);
  return hex.length <= 13 ? hex : `${hex.slice(0, 7)}...${hex.slice(-4)}`;
}

// Parse a user-entered decimal string ("12.5") into the token's smallest unit.
export function toBaseUnits(value: string, decimals: number): bigint {
  const trimmed = value.trim();
  if (!trimmed || trimmed === ".") throw new Error("Enter an amount.");
  if (!/^\d*\.?\d*$/.test(trimmed)) throw new Error("Enter a valid amount.");
  const [wholePart, fracPart = ""] = trimmed.split(".");
  if (fracPart.length > decimals) throw new Error(`Too many decimal places (max ${decimals}).`);
  const whole = wholePart === "" ? "0" : wholePart;
  const frac = fracPart.padEnd(decimals, "0");
  const units = BigInt(whole) * 10n ** BigInt(decimals) + (decimals > 0 ? BigInt(frac || "0") : 0n);
  if (units <= 0n) throw new Error("Amount must be greater than zero.");
  return units;
}

// Format the token's smallest unit back into a human decimal string.
export function fromBaseUnits(amount: bigint, decimals: number): string {
  const negative = amount < 0n;
  const abs = negative ? -amount : amount;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = (abs % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  const out = frac ? `${whole}.${frac}` : `${whole}`;
  return negative ? `-${out}` : out;
}
