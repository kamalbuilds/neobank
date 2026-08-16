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
            paid in public STRK from this wallet, not from the shielded note
          </div>
        )}
      </div>
      <span className={styles.feeVal}>
        {error ? "unavailable" : fee === undefined ? "reading…" : `${fromBaseUnits(fee, 18)} STRK`}
      </span>
    </div>
  );
}
