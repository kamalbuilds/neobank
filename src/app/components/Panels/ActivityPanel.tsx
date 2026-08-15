"use client";
import { useEffect, useState } from "react";
import styles from "../../uni.module.css";
import { useStoreWallet } from "../Wallet/walletContext";
import { explorerTxUrl, tokenForAddress, type NetworkKey } from "@/utils/constants";
import { fromBaseUnits, shortHex } from "../lib/format";
import { getPoolActivity, type PoolActivityEntry } from "../lib/history";

export default function ActivityPanel({ network }: { network: NetworkKey }) {
  const address = useStoreWallet((s) => s.address);

  const [entries, setEntries] = useState<PoolActivityEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!address) {
      setEntries([]);
      setError(undefined);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    getPoolActivity(network, address)
      .then((result) => {
        if (!cancelled) setEntries(result);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.message ?? "Could not read pool activity.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [network, address]);

  if (!address) {
    return (
      <div className={styles.panel}>
        <div className={styles.warn}>Connect a wallet to see your deposit activity.</div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.warn} style={{ color: "var(--muted)" }}>
        These are your public deposit legs into the STRK20 pool, not private transfers. Each row is
        matched on the deposit event&apos;s depositor key, never on the transaction sender, so a
        relayer-submitted deposit still shows under your address.
      </div>

      <div className={styles.inputBlock} style={{ marginTop: 16 }}>
        <div className={styles.inputLabel}>Deposit activity</div>

        {loading ? (
          <div className={styles.subLine} style={{ marginTop: 12 }}>
            Reading pool events…
          </div>
        ) : error ? (
          <div className={styles.errorText}>{error}</div>
        ) : entries.length === 0 ? (
          <div className={styles.subLine} style={{ marginTop: 12 }}>
            No deposits found for this address yet.
          </div>
        ) : (
          <div className={styles.receiptRows} style={{ marginTop: 12 }}>
            {entries.map((entry) => {
              const token = entry.token ? tokenForAddress(entry.token) : undefined;
              const amountLabel =
                entry.amount !== undefined
                  ? `${fromBaseUnits(entry.amount, token?.decimals ?? 18)} ${token?.symbol ?? "?"}`
                  : "amount unavailable";
              return (
                <div key={entry.txHash} className={styles.receiptRow}>
                  <span className={styles.receiptLabel}>
                    Deposit · block {entry.block}
                    <br />
                    {amountLabel}
                  </span>
                  <a
                    className={styles.receiptLink}
                    href={explorerTxUrl(network, entry.txHash)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {shortHex(entry.txHash)} ↗
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
