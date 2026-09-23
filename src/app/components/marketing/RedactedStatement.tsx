'use client';

import { useEffect, useState } from 'react';
import { shortenHex } from '@/lib/evidence';
import { explorerTxUrl, type NetworkKey } from '@/utils/constants';

/**
 * The showpiece. A cream statement sheet with every amount under a real ink
 * bar, and one control that lifts the bars off left to right.
 *
 * The rows are not illustration. Each one is a settled transaction listed in
 * src/lib/evidence.ts or strk20.json, its description links to that hash on
 * Voyager, and its amount is the figure the receipt actually carries. Dates are
 * the block timestamps those hashes landed in, read from the Starknet RPC
 * (mainnet block 13281484 = 1786712484, Sepolia 14083493 = 1787759489,
 * 14109923 = 1787803551, 14111945 = 1787806921, 14139603 = 1787853020).
 *
 * The CCTP row is the one amount evidence.ts does not spell out. It was read
 * from the receipt instead: the Transfer into the pool in that transaction is
 * 0xf4240, and USDC carries six decimals, so the row says 1 USDC. A chain read
 * outranks a doc, which is why it is here rather than dropped.
 */
type StatementRow = {
  date: string;
  description: string;
  network: NetworkKey;
  amount: string;
  hash: string;
};

const ROWS: StatementRow[] = [
  {
    date: '2026-08-14',
    description: 'First shield into the canonical pool',
    network: 'mainnet',
    // evidence.ts TX_RECORD "First mainnet shield (STRK)": 0.1 STRK shielded.
    amount: '0.1 STRK',
    hash: '0x04c4bea05417ce1062adef39b3d3b300f831ec994bbb4166d6010c4838d49193',
  },
  {
    date: '2026-08-26',
    description: 'Card swipe settled to the merchant',
    network: 'sepolia',
    // evidence.ts "Hosted card authorization loop": AuthorizationSettled for
    // 0.5 STRK. strk20.json first_settlement_amount = 500000000000000000.
    amount: '0.5 STRK',
    hash: '0x063b3fe7e13e9baca4d0a9ca9616b7b5e71504b38ed02bb3b98512935988acf4',
  },
  {
    date: '2026-08-27',
    description: 'Dinner paid, lending position opened',
    network: 'sepolia',
    // evidence.ts: pool withdrew 10.24 STRK, 0.24 to the merchant, 10 to the vault.
    amount: '10.24 STRK',
    hash: '0x4d94fa79724d3e997604e4a42a54daab3cc68f4ec17672b3ca9644a843e2639',
  },
  {
    date: '2026-08-27',
    description: 'Same dinner, paid from vault shares',
    network: 'sepolia',
    // evidence.ts: PositionRedeemed plus AuthorizationSettled, recipient up 0.24 STRK.
    amount: '0.24 STRK',
    hash: '0x45b8c5d7a7cae0a9f98d69e92c1120c0bee831e68f9795fde00e1f3ffa3f0e0',
  },
  {
    date: '2026-08-27',
    description: 'Funded in from Base over CCTP V2',
    network: 'sepolia',
    amount: '1 USDC',
    hash: '0x28b053d9a670650604bf8f7ae8b67fc7f296d2f4fa630a987e7a6f775b11fe2',
  },
];

/** Gap between one row's bar lifting and the next. */
const STAGGER_MS = 60;

/** Owner account behind the deployments and settlements, per strk20.json. */
const OWNER_ACCOUNT = '0x071c62dfb692c3821a9ef120919f388b4559cb2d414c7378da62e6bf7f4f494d';

function NetworkStamp({ network }: { network: NetworkKey }) {
  const mainnet = network === 'mainnet';
  return (
    <span
      className={
        mainnet
          ? 'inline-flex shrink-0 items-center rounded-[3px] border border-seal bg-seal px-[7px] py-[2px] text-[11px] font-semibold uppercase tracking-[0.1em] text-paper'
          : 'inline-flex shrink-0 items-center rounded-[3px] border border-[rgba(22,22,26,0.3)] px-[7px] py-[2px] text-[11px] font-semibold uppercase tracking-[0.1em] text-paper-muted'
      }
    >
      {network}
    </span>
  );
}

export function RedactedStatement() {
  const [open, setOpen] = useState(false);
  const [animate, setAnimate] = useState(false);
  /** How many bars have been told to lift. Drives the left-to-right cascade. */
  const [lifting, setLifting] = useState(0);

  /**
   * The wipe lives on .redact-reveal::after as an `animation` shorthand, which
   * pins animation-delay to 0s. globals.css declares it outside any cascade
   * layer, so a Tailwind `after:[animation-delay:*]` utility loses to it no
   * matter the specificity, and globals.css is not this component's to edit.
   * The stagger is therefore scheduled here instead: same 60ms cadence, same
   * single class doing the wipe.
   */
  useEffect(() => {
    if (!open || !animate) {
      setLifting(0);
      return;
    }
    setLifting(1);
    const timers = ROWS.slice(1).map((_, i) =>
      window.setTimeout(() => setLifting(i + 2), (i + 1) * STAGGER_MS),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [open, animate]);

  function toggle() {
    if (open) {
      setOpen(false);
      setAnimate(false);
      return;
    }
    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setAnimate(!reduced);
    setOpen(true);
  }

  return (
    <div className="w-full">
      <div
        className="paper paper-torn relative px-5 pb-5 pt-6 sm:px-7 sm:pb-6 sm:pt-7"
        data-statement-redacted={open ? 'false' : 'true'}
        data-statement-lifting={lifting}
      >
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div>
            <div className="font-[family-name:var(--font-display)] text-[32px] leading-none tracking-[-0.02em] text-paper-ink">
              Sealed
            </div>
            <div className="mt-2 text-[13px] text-paper-muted">Account statement</div>
          </div>
          <dl className="figure grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[13px]">
            <dt className="text-paper-muted">Period</dt>
            <dd className="font-semibold text-paper-ink">2026-08-14 / 2026-08-27</dd>
            <dt className="text-paper-muted">Owner</dt>
            <dd className="font-semibold text-paper-ink">{shortenHex(OWNER_ACCOUNT, 8, 4)}</dd>
          </dl>
        </div>

        <div className="mt-6 flex items-baseline justify-between border-b border-[color:var(--paper-line)] pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-paper-muted">
          <span>Date and reference</span>
          <span>Amount</span>
        </div>

        <ul>
          {ROWS.map((row, i) => (
            <li key={row.hash} className="rule-paper py-3 first:border-t-0">
              <div className="flex items-baseline justify-between gap-4">
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="figure text-[13px] font-semibold text-paper-muted">
                    {row.date}
                  </span>
                  <NetworkStamp network={row.network} />
                </span>
                <span className="figure shrink-0 text-right text-[17px] font-semibold text-paper-ink">
                  {open ? (
                    animate ? (
                      <span
                        className={i < lifting ? 'redact redact-reveal' : 'redact'}
                        style={{ color: 'var(--paper-ink)', userSelect: 'auto' }}
                      >
                        {row.amount}
                      </span>
                    ) : (
                      <span>{row.amount}</span>
                    )
                  ) : (
                    <>
                      <span className="redact" aria-hidden="true">
                        {row.amount}
                      </span>
                      <span className="sr-only">Amount hidden</span>
                    </>
                  )}
                </span>
              </div>
              <p className="mt-1.5 text-[15px] leading-snug">
                <a
                  href={explorerTxUrl(row.network, row.hash)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-paper-ink underline decoration-[rgba(22,22,26,0.3)] decoration-1 underline-offset-[3px] transition-colors duration-150 hover:text-seal hover:decoration-[color:var(--seal)]"
                >
                  {row.description}
                </a>{' '}
                <span className="figure text-[13px] text-paper-muted">
                  {shortenHex(row.hash)}
                </span>
              </p>
            </li>
          ))}
        </ul>

      </div>

      <div className="mt-5">
        <button
          type="button"
          onClick={toggle}
          aria-pressed={open}
          className="rounded-[4px] bg-seal px-5 py-3 text-[15px] font-medium text-paper transition-[background-color,transform] duration-150 hover:bg-seal-bright active:scale-[0.97]"
        >
          {open ? 'Hide again' : 'Reveal with viewing key'}
        </button>
        <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-ink">
          The public chain shows these as five transfers in and out of a pool address; whose account
          they are and what is left in it stay under the viewing key.
        </p>
        <p className="mt-3 max-w-[52ch] text-[13px] leading-relaxed text-muted">
          Every row links to its receipt on Voyager. Amounts come from src/lib/evidence.ts and
          strk20.json.
        </p>
      </div>
    </div>
  );
}
