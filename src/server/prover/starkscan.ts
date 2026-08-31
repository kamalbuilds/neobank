/**
 * Client for the Starknet Foundation's STRK20 transaction prover, reached
 * through Starkscan's authenticated relay.
 *
 * Spec: https://starkscan.co/docs/api/strk20-prover
 *
 * This is what unblocks mainnet. There is no Sepolia prover, so every private
 * action on mainnet has to go through here.
 *
 * Three relay behaviours will silently cost a proof if a client ignores them,
 * so they are encoded here rather than left to each caller:
 *
 *   1. A result is delivered EXACTLY ONCE. Starkscan never writes proof
 *      payloads to disk: a completed proof is held in memory, handed over on
 *      the first successful poll, then dropped. Poll twice and the second
 *      answer carries `resultUnavailableReason: "delivered_or_expired"` and no
 *      proof. `waitForProof` therefore persists the whole job the instant it
 *      arrives and awaits that before returning, and persists the ENTIRE
 *      result rather than just `proof`, because a deposit is unusable without
 *      `additional_data`.
 *
 *   2. A deposit's screening attestation expires 300s after `issued_at`,
 *      measured against the block timestamp when `apply_actions` executes.
 *      Queue time at Starkscan does not count against it, but poll interval,
 *      broadcast and inclusion all do. Broadcasting a stale one reverts
 *      SCREENING_EXPIRED, so `attestationTooStale` exists to gate signing.
 *
 *   3. Retrying without the original Idempotency-Key starts a SECOND proof and
 *      debits the daily budget again. One key per logical submission, reused on
 *      every retry of that submission.
 */

import { randomUUID } from "node:crypto";

const BASE = "https://api.starkscan.co/v1/SN_MAIN";

/** Pool constant DEPOSITOR_VALIDATION_MAX_AGE. The contract is the source of truth if it changes. */
export const ATTESTATION_MAX_AGE_SECONDS = 300;

export type ProveJobStatus =
  | "queued"
  | "dispatched"
  | "succeeded"
  | "failed"
  | "unavailable"
  | "unknown_delivery";

export type ScreeningSignature = { issued_at: number; sig_r: string; sig_s: string };

export type ProofResult = {
  proof: string;
  proof_facts?: string;
  l2_to_l1_messages?: unknown[];
  /** Present only for screened deposits. Dropping it reverts SCREENING_REQUIRED. */
  additional_data?: { signature: ScreeningSignature };
};

export type ProveJob = {
  jobId: string;
  status: ProveJobStatus;
  terminal: boolean;
  attemptCount: number;
  queuePosition?: number;
  pollAfterSeconds?: number;
  createdAt: string;
  completedAt?: string;
  result?: ProofResult;
  resultUnavailableReason?: string;
  error?: { code: string | number; source?: string; message?: string; data?: string };
};

export class ProverNotEnabledError extends Error {}
export class ProverScopeError extends Error {}
export class ProverError extends Error {
  readonly job: ProveJob;
  constructor(message: string, job: ProveJob) {
    super(message);
    this.job = job;
  }
}

function apiKey(): string {
  const key = process.env.STARKSCAN_API_KEY;
  if (!key) {
    throw new Error(
      "STARKSCAN_API_KEY is not set. Place it in .env yourself; this code never asks for, logs or echoes it. " +
        "Access is operator-issued: create a key at starkscan.co, then submit its key ID (never the value) for whitelisting."
    );
  }
  return key;
}

/**
 * 404 and 403 are distinct states here and conflating them sends you debugging
 * the wrong thing: 404 means the relay is not enabled in this environment at
 * all (routes unregistered, every caller gets it regardless of key), 403 means
 * the relay is live but this key lacks `prove` scope.
 */
function classifyHttp(status: number, body: string): void {
  if (status === 404) {
    throw new ProverNotEnabledError(
      "Prover relay 404: the relay is not enabled in this environment. Routes are unregistered, so every caller " +
        "gets 404 regardless of key or scope. This is not a wrong URL."
    );
  }
  if (status === 403) {
    throw new ProverScopeError(
      "Prover relay 403: the relay is enabled but this key lacks `prove` scope. Prove scope cannot be created from " +
        "the API key page or redeemed through an access invite; an operator grants it after approval."
    );
  }
  if (status >= 400) throw new Error(`Prover relay HTTP ${status}: ${body.slice(0, 300)}`);
}

/** Mint one per logical submission; reuse it for every retry of that submission. */
export function newIdempotencyKey(): string {
  return randomUUID();
}

/**
 * Submit a proof request. `transaction` must be an Invoke transaction, the
 * prover rejects other kinds. `blockNumber` must be an explicit finalized
 * block: the prover simulates there, so any state the transaction depends on
 * (ERC20 approval, pool registration) must already exist AT that block, not
 * merely at head. The approval must also cover the amount PLUS
 * `get_fee_amount()`, which the pool pulls over the same allowance.
 */
export async function submitProof(args: {
  blockNumber: number;
  transaction: unknown;
  idempotencyKey: string;
}): Promise<ProveJob> {
  const res = await fetch(`${BASE}/prove`, {
    method: "POST",
    headers: {
      "X-Starkscan-Api-Key": apiKey(),
      "Idempotency-Key": args.idempotencyKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      block_id: { block_number: args.blockNumber },
      transaction: args.transaction,
    }),
  });
  const text = await res.text();
  classifyHttp(res.status, text);
  return JSON.parse(text) as ProveJob;
}

export async function pollProof(jobId: string): Promise<ProveJob> {
  const res = await fetch(`${BASE}/prove/${encodeURIComponent(jobId)}`, {
    headers: { "X-Starkscan-Api-Key": apiKey() },
  });
  const text = await res.text();
  classifyHttp(res.status, text);
  return JSON.parse(text) as ProveJob;
}

/**
 * Poll to a terminal state, honouring the server's `pollAfterSeconds`.
 *
 * `persist` receives the complete job the moment a result arrives and is
 * awaited before this returns. That ordering is the point: if the process dies
 * between delivery and persistence the proof is gone, and recovering it costs
 * another prover slot and another unit of the daily budget.
 */
export async function waitForProof(
  jobId: string,
  persist: (job: ProveJob) => Promise<void> | void,
  opts: { timeoutMs?: number } = {}
): Promise<ProveJob> {
  const deadline = Date.now() + (opts.timeoutMs ?? 20 * 60_000);

  for (;;) {
    const job = await pollProof(jobId);

    if (job.terminal) {
      if (job.result || job.error) await persist(job);

      if (job.status === "succeeded") {
        if (!job.result) {
          throw new ProverError(
            `Job ${jobId} succeeded but carried no result (${job.resultUnavailableReason ?? "unknown"}). ` +
              "It was already delivered or has expired and is not recoverable; resubmit under a NEW key.",
            job
          );
        }
        return job;
      }
      if (job.status === "unavailable") {
        throw new ProverError(
          `Job ${jobId} unavailable (${String(job.error?.code ?? "prover_unavailable")}). Retry the SAME idempotency ` +
            "key to recover this job without another debit. Do not rotate the API key.",
          job
        );
      }
      if (job.status === "unknown_delivery") {
        throw new ProverError(
          `Job ${jobId} delivery unknown. The relay cannot prove the prover received it and deliberately does not ` +
            `resend. Keep jobId and attemptCount (${job.attemptCount}) and contact support before resubmitting.`,
          job
        );
      }
      throw new ProverError(
        `Job ${jobId} failed: ${String(job.error?.code ?? "unknown")} ${job.error?.data ?? ""}`.trim(),
        job
      );
    }

    if (Date.now() > deadline) {
      throw new ProverError(`Job ${jobId} did not reach a terminal state before the local timeout.`, job);
    }
    await new Promise((r) => setTimeout(r, (job.pollAfterSeconds ?? 10) * 1000));
  }
}

/**
 * Milliseconds of attestation life left, or null when there is no attestation.
 * Transfers and withdrawals must NOT carry one (including it reverts
 * UNEXPECTED_SCREENING), so null is a valid, expected answer.
 *
 * The result cache outlives the attestation, so a late poll can return a result
 * still fine for a transfer and already dead for a deposit.
 */
export function attestationRemainingMs(result: ProofResult, now = Date.now()): number | null {
  const issuedAt = result.additional_data?.signature?.issued_at;
  if (typeof issuedAt !== "number") return null;
  return issuedAt * 1000 + ATTESTATION_MAX_AGE_SECONDS * 1000 - now;
}

/** True when a deposit should be re-proved rather than broadcast. */
export function attestationTooStale(result: ProofResult, marginMs = 60_000, now = Date.now()): boolean {
  const remaining = attestationRemainingMs(result, now);
  return remaining === null ? false : remaining < marginMs;
}
