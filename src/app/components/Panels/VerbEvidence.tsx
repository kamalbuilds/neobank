"use client";
import type { ReactNode } from "react";
import { TX_RECORD, type TxRow } from "@/lib/evidence";
import { cx } from "../v2/ui";

/**
 * What a verb has already done on chain, printed on paper, for the reader who
 * has no wallet connected.
 *
 * A disconnected panel used to be a redaction bar over a disabled form, which
 * is indistinguishable from a product that does not work. The redaction is
 * correct and stays; what was missing underneath it is the proof. Every row
 * here comes out of src/lib/evidence.ts, which `npm run verify:evidence` reads
 * back against chain, so no hash, block or status is restated by hand.
 *
 * The `verdict` prop is load bearing. A verb whose own leg has never settled
 * says so in the first line and names what has settled instead. Presenting a
 * neighbouring transaction as if it were this verb's is the one failure this
 * component exists to prevent.
 */

/** Look receipts up by hash, in the order asked for. Unknown hashes are dropped. */
export function receiptsFor(hashes: readonly string[]): TxRow[] {
  return hashes
    .map((hash) => TX_RECORD.find((row) => row.hash === hash))
    .filter((row): row is TxRow => row !== undefined);
}

export default function VerbEvidence({
  title,
  verdict,
  receiptsLabel,
  receipts,
  stamp,
  footnote,
  className,
}: {
  /** The headline verdict: what this leg has or has not done. */
  title: string;
  /** The honest sentence under it. Never softened to fit the receipts. */
  verdict: ReactNode;
  /** What the rows below actually are, said plainly. */
  receiptsLabel: string;
  receipts: TxRow[];
  /** The network the rows were settled on, stamped at the top right. */
  stamp: string;
  footnote?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("paper p-4 sm:p-5", className)} aria-label={title}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b-[3px] border-double border-[var(--paper-line)] pb-2.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-paper-muted">
          Sealed · settled record
        </h3>
        <span className="figure inline-flex shrink-0 rotate-[-3deg] items-center border border-[color:var(--seal)] px-2 py-0.5 text-[13px] font-semibold uppercase tracking-[0.1em] text-seal">
          {stamp}
        </span>
      </div>

      <p className="mt-3 font-[family-name:var(--font-display)] text-[22px] leading-[1.15] tracking-[-0.015em] text-paper-ink">
        {title}
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-paper-muted">{verdict}</p>

      <p className="mt-4 border-t border-[var(--paper-line)] pt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-paper-muted">
        {receiptsLabel}
      </p>

      {receipts.length === 0 ? (
        <p className="mt-3 border-l-2 border-[color:var(--seal)] pl-3 text-[13px] leading-relaxed text-paper-ink">
          No receipt is recorded for this leg. Nothing is shown in its place, because an invented
          hash would cost more than an empty list. Run the flow with a wallet connected and the
          transaction it produces is the first entry here.
        </p>
      ) : (
        <ul className="mt-1">
          {receipts.map((row) => (
            <li key={row.hash} className="rule-paper py-3 first:border-t-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="text-[13px] font-semibold text-paper-ink">{row.label}</span>
                <span className="figure text-[13px] font-semibold text-ledger-green">
                  {row.status}
                </span>
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-paper-muted">{row.detail}</p>
              <div className="mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <a
                  href={row.href}
                  target="_blank"
                  rel="noreferrer"
                  className="figure break-all text-[13px] font-semibold text-paper-ink underline decoration-[color:var(--paper-line)] underline-offset-4 hover:decoration-[color:var(--seal)]"
                >
                  {row.hash}
                </a>
                <span className="figure shrink-0 text-[13px] font-semibold text-paper-ink">
                  {row.network} · block {row.block ?? "not reported"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {footnote ? (
        <p className="mt-3 border-t border-[var(--paper-line)] pt-3 text-[13px] leading-relaxed text-paper-muted">
          {footnote}
        </p>
      ) : null}
    </section>
  );
}
