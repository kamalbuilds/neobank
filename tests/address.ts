// Duplicates the BigInt compare used in src/app/components/lib/history.ts
// (sameAddress is not exported there, and this file must not touch the RPC pager).
export function sameAddress(a: string, b: string): boolean {
  try {
    return BigInt(a) === BigInt(b);
  } catch {
    return false;
  }
}
