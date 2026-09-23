import Link from 'next/link';
import { CONTRACT_RECORD, RETIRED_CONTRACTS, TX_RECORD } from '@/lib/evidence';

/**
 * The counts a reviewer reaches for first, counted rather than typed. Every
 * figure below is derived from src/lib/evidence.ts at build time, so a row
 * added or removed there moves the number here; none of it is a literal.
 *
 * evidence.ts carries a block number per transaction but no "verified at"
 * timestamp, so this stamp deliberately claims no freshness date. The command
 * that re-reads the record against chain is named instead.
 */
const SETTLED = TX_RECORD.length;
const SETTLED_MAINNET = TX_RECORD.filter((t) => t.network === 'mainnet').length;
const SETTLED_SEPOLIA = TX_RECORD.filter((t) => t.network === 'sepolia').length;
const CONTRACTS = CONTRACT_RECORD.length;
const CONTRACTS_OURS = CONTRACT_RECORD.filter((c) => c.origin === 'sealed').length;
const CONTRACTS_STARKWARE = CONTRACT_RECORD.filter((c) => c.origin === 'starkware').length;
const RETIRED = RETIRED_CONTRACTS.length;

const FIGURES: { value: number; label: string; split: string }[] = [
  {
    value: SETTLED,
    label: 'settled transactions on the record',
    split: `${SETTLED_MAINNET} on mainnet, ${SETTLED_SEPOLIA} on Sepolia`,
  },
  {
    value: CONTRACTS,
    label: 'contracts behind them',
    split: `${CONTRACTS_OURS} deployed for this project, ${CONTRACTS_STARKWARE} of StarkWare's`,
  },
  {
    value: RETIRED,
    label: 'deployment retired, still listed',
    split: 'The vault class whose missing allowance entrypoint reverted the atomic lend',
  },
];

export function EvidenceStamp() {
  return (
    <section aria-label="Evidence counts" className="rule mt-14 pt-8 lg:mt-20">
      <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-3">
        {FIGURES.map((f) => (
          <div key={f.label}>
            <dd className="figure text-[44px] font-semibold leading-none tracking-[-0.03em] text-ink">
              {f.value}
            </dd>
            <dt className="mt-3 text-[15px] leading-snug text-ink">{f.label}</dt>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">{f.split}</p>
          </div>
        ))}
      </dl>
      <p className="mt-8 text-[13px] leading-relaxed text-muted">
        Counted from{' '}
        <span className="figure text-ink">src/lib/evidence.ts</span>, which imports every address
        from <span className="figure text-ink">src/utils/constants.ts</span> rather than restating
        it.{' '}
        <span className="figure text-ink">npm run verify:evidence</span> reads the record back
        against chain.{' '}
        <Link
          href="/docs/evidence"
          className="text-ink underline decoration-[color:var(--line-strong)] underline-offset-4 transition-colors duration-150 hover:decoration-[color:var(--ink)]"
        >
          Open the full record
        </Link>
        .
      </p>
    </section>
  );
}
