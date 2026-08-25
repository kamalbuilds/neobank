"use client";
import styles from "../../uni.module.css";
import { fromBaseUnits } from "../lib/format";

export default function FeeRow({ fee, error }: { fee: bigint | undefined; error?: string }) {
  return (
    <div className={styles.feeRow}>
      <div>
        <span>Pool fee (per private operation)</span>
        {!error && (
          <div style={{ color: "var(--muted)", fontSize: 12 }}>
            charged in STRK by the pool; Ready shows the exact debit before approval
          </div>
        )}
      </div>
      <span className={styles.feeVal}>
        {error ? "unavailable" : fee === undefined ? "reading…" : `${fromBaseUnits(fee, 18)} STRK`}
      </span>
    </div>
  );
}
