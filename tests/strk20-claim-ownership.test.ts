import { describe, expect, it } from 'vitest';
import { checkTransaction } from '../scripts/verify-strk20-claim.mjs';

/**
 * The submission verifier printed "SCOREABLE: 3 of 3" for weeks while the
 * hackathon hub recorded `verified_txs: 0, mainnet: false` for the same three
 * transactions. Both were reading the same chain. The tool simply never
 * implemented one clause of the rule:
 *
 *   CONTRIBUTING.md - "If you listed anything in `contracts`, the transaction
 *   must also carry an event from one of them - touching the pool through
 *   someone else's contract is not your project running on mainnet."
 *
 * A check that cannot report the failure it exists to catch is worse than no
 * check, because its green is quoted as evidence. These tests pin the clause
 * against the three real mainnet hashes.
 *
 * They hit a live RPC on purpose: the bug was a disagreement with the chain,
 * and a mocked receipt would have agreed with whatever the code already did.
 */

const REAL_MAINNET_SHIELDS = [
  '0x04c4bea05417ce1062adef39b3d3b300f831ec994bbb4166d6010c4838d49193',
  '0x059eb6c1bdddd048006f372b4db6602560dbfc722536b94d59ece8abb865586e',
  '0xe08fd329091b483978c64f93288b7346b158e0dc485fd7c5f594899f0294',
];

/** Our real deployments. All Sepolia, which is the whole problem. */
const OUR_SEPOLIA_CONTRACTS = [
  '0x074dcd5ee5e0fbfdcf25a7cbc3408711de19fccdf46e8f53c71d35e795f5390a',
  '0x059524ff1c689a45b92e0ff02c752b261805409ff5940721aa4c382ac6b572a4',
];

const RPC_TIMEOUT = 30_000;

describe('the contracts clause', () => {
  it(
    'passes a pool transaction when the submission declares no contracts',
    async () => {
      // The hub calls this `mine === null`: nothing deployed, so the question
      // does not apply and the pool event alone decides.
      const row = await checkTransaction(REAL_MAINNET_SHIELDS[0], undefined, []);
      expect(row.execution).toBe('SUCCEEDED');
      expect(row.poolEvents).toBeGreaterThan(0);
      expect(row.mine).toBeNull();
      expect(row.pass).toBe(true);
    },
    RPC_TIMEOUT,
  );

  it.each(REAL_MAINNET_SHIELDS)(
    'fails %s once Sepolia-only contracts are declared',
    async (hash) => {
      // This is the exact state of strk20.json today, and the exact reason the
      // hub shows verified_txs: 0.
      const row = await checkTransaction(hash, undefined, OUR_SEPOLIA_CONTRACTS);
      expect(row.execution).toBe('SUCCEEDED');
      expect(row.poolEvents).toBeGreaterThan(0);
      expect(row.mine).toBe(false);
      expect(row.pass).toBe(false);
      expect(row.reason).toBe("touched the pool, but not through this project's contracts");
    },
    RPC_TIMEOUT,
  );

  it(
    'still reports a genuinely bad transaction as bad, not merely unowned',
    async () => {
      // A hash that does not exist must not be reported with the contracts
      // reason, or the message would send someone to fix the wrong thing.
      const row = await checkTransaction(
        '0x' + '1'.repeat(63),
        undefined,
        OUR_SEPOLIA_CONTRACTS,
      );
      expect(row.pass).toBe(false);
      expect(row.reason).not.toContain("this project's contracts");
    },
    RPC_TIMEOUT,
  );
});
