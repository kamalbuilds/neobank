"use client";
import { useEffect, useState } from "react";
import { ui } from "../lib/panelUi";
import { Skeleton } from "../v2/ui";
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
      <div className={ui.panel}>
        <div className={ui.warn}>Connect a wallet to see your deposit activity.</div>
      </div>
    );
  }

  return (
    <div className={ui.panel}>
      <div className={ui.warn} style={{ color: "var(--muted)" }}>
        These are your public deposit legs into the STRK20 pool, not private transfers. Each row is
        matched on the deposit event&apos;s depositor key, never on the transaction sender, so a
        relayer-submitted deposit still shows under your address.
      </div>

      <div className={`${ui.inputBlock} mt-4`}>
        <div className={ui.inputLabel}>Deposit activity</div>

        {loading ? (
          <div className="mt-3 flex flex-col gap-2" aria-busy="true" aria-label="Reading pool events">
            <Skeleton className="h-[52px]" />
            <Skeleton className="h-[52px]" />
          </div>
        ) : error ? (
          <div className={ui.errorText} role="alert">{error}</div>
        ) : entries.length === 0 ? (
          <div className={`${ui.subLine} mt-3`}>
            No deposits into the pool from this address yet. Shield STRK or USDC to see it here.
          </div>
        ) : (
          <div className={ui.receiptRows} style={{ marginTop: 12 }}>
            {entries.map((entry) => {
              const token = entry.token ? tokenForAddress(entry.token) : undefined;
              const amountLabel =
                entry.amount !== undefined
                  ? `${fromBaseUnits(entry.amount, token?.decimals ?? 18)} ${token?.symbol ?? "?"}`
                  : "amount unavailable";
              return (
                <div key={entry.txHash} className={ui.receiptRow}>
                  <span className={ui.receiptLabel}>
                    Deposit · block {entry.block}
                    <br />
                    {amountLabel}
                    {entry.amount !== undefined ? " into the pool, pool fee included" : ""}
                  </span>
                  <a
                    className={ui.receiptLink}
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
