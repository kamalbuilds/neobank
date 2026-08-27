"use client";
import { ui } from "../lib/panelUi";
import { fromBaseUnits } from "../lib/format";

export default function FeeRow({ fee, error }: { fee: bigint | undefined; error?: string }) {
  return (
    <div className={ui.feeRow}>
      <div>
        <span>Pool fee (per private operation)</span>
        {!error && (
          <div className="mt-1 text-[12px] text-[#7a859c]">
            charged in STRK by the pool; Ready shows the exact debit before approval
          </div>
        )}
      </div>
      <span className={ui.feeVal}>
        {error ? "unavailable" : fee === undefined ? "reading…" : `${fromBaseUnits(fee, 18)} STRK`}
      </span>
    </div>
  );
}
