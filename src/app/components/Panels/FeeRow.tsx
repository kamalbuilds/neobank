"use client";
import { ui } from "../lib/panelUi";
import { cx } from "../v2/ui";
import { fromBaseUnits } from "../lib/format";

/**
 * The pool fee is admin settable, so it is always a live read. When the read
 * fails the row says so instead of showing the last figure it happened to
 * hold: a stale fee here is the number a user budgets against.
 */
export default function FeeRow({ fee, error }: { fee: bigint | undefined; error?: string }) {
  return (
    <div className={ui.feeRow}>
      <div className="min-w-0">
        <span>Pool fee (per private operation)</span>
        <div className="mt-1 text-[11px] leading-snug text-muted">
          {error
            ? "the pool contract did not answer, so no figure is shown rather than a stale one"
            : "charged in STRK by the pool; Ready shows the exact debit before approval"}
        </div>
      </div>
      <span className={cx(ui.feeVal, error && "text-seal-bright")}>
        {error ? "unavailable" : fee === undefined ? "reading…" : `${fromBaseUnits(fee, 18)} STRK`}
      </span>
    </div>
  );
}
