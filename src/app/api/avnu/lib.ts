import {
  BASE_URL,
  PAYMASTER_BASE_URL,
  PRIVACY_POOL_ADDRESS,
  SEPOLIA_BASE_URL,
  SEPOLIA_PAYMASTER_BASE_URL,
  SEPOLIA_PRIVACY_POOL_ADDRESS,
  type AvnuOptions,
} from "@avnu/avnu-sdk";
import type { NetworkKey } from "@/utils/constants";
export { requireAvnuKey } from "./key";

export function parseNetwork(value: unknown): NetworkKey {
  if (value === "sepolia" || value === "mainnet") return value;
  return "mainnet";
}

export function avnuOptions(network: NetworkKey): AvnuOptions {
  return network === "sepolia"
    ? { baseUrl: SEPOLIA_BASE_URL, paymasterBaseUrl: SEPOLIA_PAYMASTER_BASE_URL }
    : { baseUrl: BASE_URL, paymasterBaseUrl: PAYMASTER_BASE_URL };
}

export function poolAddress(network: NetworkKey): string {
  return network === "sepolia" ? SEPOLIA_PRIVACY_POOL_ADDRESS : PRIVACY_POOL_ADDRESS;
}

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const rateLimitHits = new Map<string, number[]>();

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function enforceRateLimit(request: Request, bucket: string): void {
  const key = `${bucket}:${clientIp(request)}`;
  const now = Date.now();
  const hits = (rateLimitHits.get(key) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (hits.length >= RATE_LIMIT_MAX) {
    throw Object.assign(new Error("Too many requests. Try again shortly."), { status: 429 });
  }
  hits.push(now);
  rateLimitHits.set(key, hits);
}

export function jsonError(error: unknown): Response {
  const status = typeof (error as { status?: number })?.status === "number" ? (error as { status: number }).status : 500;
  const message = error instanceof Error ? error.message : "AVNU request failed.";
  return Response.json({ error: message }, { status });
}
