"use client";
import styles from "../../uni.module.css";
import { fromBaseUnits } from "../lib/format";

export default function FeeRow({ fee, error }: { fee: bigint | undefined; error?: string }) {
  return (
    <div className={styles.feeRow}>
      <span>Pool fee (per private operation)</span>
      <span className={styles.feeVal}>
        {error ? "unavailable" : fee === undefined ? "reading…" : `${fromBaseUnits(fee, 18)} STRK`}
      </span>
    </div>
  );
}
