"use client";
import { useCallback, useEffect, useState } from "react";
import { ui } from "../lib/panelUi";
import { useStoreWallet } from "../Wallet/walletContext";
import { explorerTxUrl, providerFor, tokenForAddress, type NetworkKey } from "@/utils/constants";
import { fromBaseUnits, shortHex } from "../lib/format";
import { getPoolActivity, type PoolActivityEntry } from "../lib/history";
import { Figure, HowThisWorks, PanelState, PaperSheet } from "../v2/ui";

export default function ActivityPanel({ network }: { network: NetworkKey }) {
  const address = useStoreWallet((s) => s.address);

  const [entries, setEntries] = useState<PoolActivityEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [block, setBlock] = useState<number | undefined>(undefined);
  const [readAt, setReadAt] = useState<Date | undefined>(undefined);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!address) {
      setEntries([]);
      setError(undefined);
      setReadAt(undefined);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    Promise.all([getPoolActivity(network, address), providerFor(network).getBlockNumber().catch(() => undefined)])
      .then(([result, head]) => {
        if (cancelled) return;
        setEntries(result);
        setBlock(head);
        setReadAt(new Date());
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
  }, [network, address, nonce]);

  return (
    <div className={ui.panel}>
      <div>
        <h2 className={ui.heading}>Deposit history</h2>
        <p className={`${ui.note} mt-1.5`}>
          Deposits into your shielded balance. Private sends and payments don&apos;t appear here -
          only this account can see those.
        </p>
        <HowThisWorks className="mt-2">
          <p>
            Each row is matched to your account&apos;s own key, not to whichever wallet or relayer
            actually submitted the transaction, so it stays accurate even when a deposit was
            relayed on your behalf.
          </p>
        </HowThisWorks>
      </div>

      {/* The ledger is a statement, so it prints on paper. */}
      <PaperSheet className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 border-b-[3px] border-double border-[var(--paper-line)] pb-2.5">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-paper-muted">
            Deposit activity
          </h3>
          <Figure
            className={
              network === "mainnet"
                ? "text-[13px] font-semibold text-paper-ink"
                : "text-[13px] text-paper-muted"
            }
          >
            {network === "mainnet" ? "mainnet" : "sepolia"}
          </Figure>
        </div>

        {!address ? (
          <PanelState kind="empty" tone="paper" title="No account linked yet" className="mt-4">
            Link a wallet and every deposit you have ever made into the pool lists here, each one
            with the block it landed in and a Voyager link.
          </PanelState>
        ) : loading ? (
          <PanelState
            kind="loading"
            tone="paper"
            rows={2}
            title="Scanning pool deposit events"
            className="mt-4"
          />
        ) : error ? (
          <PanelState kind="error" tone="paper" title="Could not read pool activity" className="mt-4">
            {error} Nothing is listed from a cache, so use Re-read below once the RPC recovers.
          </PanelState>
        ) : entries.length === 0 ? (
          <PanelState kind="empty" tone="paper" title="No deposits from this address yet" className="mt-4">
            Shield STRK or USDC in the panel above and the deposit lands here with its block and
            transaction hash.
          </PanelState>
        ) : (
          <div className="mt-1">
            {entries.map((entry) => {
              const token = entry.token ? tokenForAddress(entry.token) : undefined;
              const amountLabel =
                entry.amount !== undefined
                  ? `${fromBaseUnits(entry.amount, token?.decimals ?? 18)} ${token?.symbol ?? "?"}`
                  : "amount unavailable";
              return (
                <div
                  key={entry.txHash}
                  className="flex items-baseline justify-between gap-4 border-t border-[var(--paper-line)] py-2.5 first:border-t-0"
                >
                  <span className="min-w-0 text-[13px] leading-snug text-paper-muted">
                    <Figure className="font-semibold text-paper-ink">{amountLabel}</Figure>
                    {entry.amount !== undefined ? " into the pool, pool fee included" : ""}
                    <span className="mt-0.5 block">
                      Deposit · block <Figure>{entry.block.toLocaleString("en-US")}</Figure>
                    </span>
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

        {address ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--paper-line)] pt-3">
            <p className="text-[13px] leading-relaxed text-paper-muted">
              {readAt ? (
                <>
                  Read from {network === "mainnet" ? "Starknet mainnet" : "Starknet Sepolia"}
                  {block !== undefined ? (
                    <>
                      {" at block "}
                      <Figure className="font-semibold text-paper-ink">
                        {block.toLocaleString("en-US")}
                      </Figure>
                    </>
                  ) : null}
                  {", "}
                  <Figure>{readAt.toLocaleTimeString("en-US", { hour12: false })}</Figure> local.
                </>
              ) : (
                "Not read yet."
              )}
            </p>
            <button
              type="button"
              className="rounded-[4px] border border-[var(--paper-line)] px-2.5 py-1 text-[13px] font-semibold text-paper-ink transition-[background-color,transform] duration-150 hover:bg-[var(--paper-2)] active:scale-[0.97] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--seal)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)]"
              onClick={refresh}
              disabled={loading}
            >
              {loading ? "Re-reading…" : "Re-read"}
            </button>
          </div>
        ) : null}
      </PaperSheet>
    </div>
  );
}
