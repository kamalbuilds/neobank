/**
 * The attestation `scripts/verify-evidence.mjs` writes on every run.
 *
 * The evidence page claimed it was verified against a live RPC without saying
 * when, and a verification claim with no stamp is indistinguishable from one
 * that stopped being true. This module carries the last run's own output, so
 * the page shows a block height and a timestamp it did not choose. If the file
 * is missing, `readAttestation` returns null and the page must say the evidence
 * is unverified rather than quietly rendering nothing.
 */
import attestation from './evidence-verification.json';

export type EvidenceAttestation = {
  /** ISO timestamp of the run. */
  ranAt: string;
  checked: number;
  passed: number;
  failed: number;
  /** Chain head at the moment of the run, per network. Null if the RPC refused. */
  blocks: { mainnet: number | null; sepolia: number | null };
  rpc: { mainnet: string; sepolia: string };
};

/** How old an attestation may be before the page should call it stale. */
export const STALE_AFTER_HOURS = 72;

export function readAttestation(): EvidenceAttestation | null {
  const a = attestation as Partial<EvidenceAttestation>;
  if (!a || typeof a.ranAt !== 'string' || typeof a.checked !== 'number') return null;
  return a as EvidenceAttestation;
}

export function ageInHours(a: EvidenceAttestation, now: Date = new Date()): number {
  return (now.getTime() - new Date(a.ranAt).getTime()) / 3_600_000;
}

export function isStale(a: EvidenceAttestation, now: Date = new Date()): boolean {
  return ageInHours(a, now) > STALE_AFTER_HOURS;
}

/**
 * One line for the page: what ran, what it found, and when. Callers decide the
 * colour from `failed` and `isStale`; this never claims a pass it cannot see.
 */
export function stampLine(a: EvidenceAttestation): string {
  const when = new Date(a.ranAt).toISOString().replace('T', ' ').slice(0, 16);
  const block = a.blocks.mainnet ?? a.blocks.sepolia;
  const at = block === null ? '' : `, read at block ${block.toLocaleString('en-US')}`;
  return `verify-evidence.mjs: ${a.passed} of ${a.checked} passed${at}, ${when} UTC`;
}
