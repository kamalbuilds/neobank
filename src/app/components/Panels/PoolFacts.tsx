"use client";
import { useCallback, useEffect, useState } from "react";
import {
  explorerAddressUrl,
  getPoolFeeAmount,
  poolAddressFor,
  providerFor,
  TOKENS,
  type NetworkKey,
} from "@/utils/constants";
import { fromBaseUnits } from "../lib/format";
import { ui } from "../lib/panelUi";
import { cx, Figure, LedgerRow, PanelState, StatusPill } from "../v2/ui";

/**
 * Everything on this surface is readable from a public RPC with no wallet
 * connected, which is the point: a reviewer who has never installed Ready and
 * holds no Sepolia STRK still sees the app talking to a live contract rather
 * than a locked door. Both reads are taken against the same block so the
 * provenance line describes the figures beside it and not some later state.
 */
export interface PoolSnapshot {
  block?: number;
  fee?: bigint;
  readAt?: Date;
  loading: boolean;
  error?: string;
  refresh: () => void;
}

export function usePoolSnapshot(network: NetworkKey): PoolSnapshot {
  const [block, setBlock] = useState<number | undefined>(undefined);
  const [fee, setFee] = useState<bigint | undefined>(undefined);
  const [readAt, setReadAt] = useState<Date | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    const provider = providerFor(network);
    Promise.all([provider.getBlockNumber(), getPoolFeeAmount(network)])
      .then(([blockNumber, feeAmount]) => {
        if (cancelled) return;
        setBlock(blockNumber);
        setFee(feeAmount);
        setReadAt(new Date());
      })
      .catch((err: any) => {
        if (cancelled) return;
        setBlock(undefined);
        setFee(undefined);
        setReadAt(undefined);
        setError(err?.message ?? "The RPC did not answer. The figures below would be stale, so none are shown.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [network, nonce]);

  return { block, fee, readAt, loading, error, refresh };
}

/** mainnet is the loud register, sepolia the quiet one. Never the reverse. */
export function NetworkChip({ network, className }: { network: NetworkKey; className?: string }) {
  return (
    <StatusPill
      tone={network === "mainnet" ? "live" : "neutral"}
      className={className}
      title={
        network === "mainnet"
          ? "Mainnet: the live STRK20 pool, real STRK"
          : "Sepolia testnet: real transactions, test money"
      }
    >
      {/* "testnet" stays in the visible label rather than only in the title.
          A tooltip never appears on touch, and the one thing a user must not
          have to hover for is whether their money is real. */}
      {network === "mainnet" ? "mainnet" : "sepolia testnet"}
    </StatusPill>
  );
}

/**
 * The provenance line every chain-read figure owes the reader: which network,
 * which block, and when it was read. A number without these is a claim that
 * stopped being checkable the moment it was rendered.
 */
export function ReadStamp({
  network,
  block,
  readAt,
  className,
}: {
  network: NetworkKey;
  block?: number;
  readAt?: Date;
  className?: string;
}) {
  return (
    <p className={cx("text-[13px] leading-relaxed text-muted", className)}>
      Read from {network === "mainnet" ? "Starknet mainnet" : "Starknet Sepolia"}
      {block !== undefined ? (
        <>
          {" at block "}
          <Figure className="font-semibold text-ink">{block.toLocaleString("en-US")}</Figure>
        </>
      ) : null}
      {readAt ? (
        <>
          {", "}
          <Figure>{readAt.toLocaleTimeString("en-US", { hour12: false })}</Figure>
          {" local"}
        </>
      ) : null}
      .
    </p>
  );
}

/**
 * The read-only preview. Renders identically with or without a wallet, so the
 * disconnected state shows a working product instead of a placeholder.
 */
export default function PoolFacts({
  network,
  snapshot,
  className,
}: {
  network: NetworkKey;
  snapshot: PoolSnapshot;
  className?: string;
}) {
  const pool = poolAddressFor(network);

  return (
    <section className={cx("doc p-4 sm:p-5", className)} aria-label="Live pool reads">
      <div className="flex items-center justify-between gap-3 border-b-[3px] border-double border-[var(--line-strong)] pb-2.5">
        <h2 className={ui.caption}>Live from the pool</h2>
        <NetworkChip network={network} />
      </div>

      {snapshot.loading && snapshot.fee === undefined && !snapshot.error ? (
        <PanelState
          kind="loading"
          rows={2}
          title="Reading the pool contract"
          className="mt-3"
        />
      ) : snapshot.error ? (
        <PanelState kind="error" title="Could not reach the Starknet RPC" className="mt-3">
          {snapshot.error} Nothing below is filled in from a cache, so use Re-read once the
          network is back.
        </PanelState>
      ) : (
        <div className="mt-1">
          <LedgerRow
            label="Pool fee"
            hint="charged per private operation, admin settable, so it is read at runtime"
          >
            {snapshot.fee !== undefined
              ? `${fromBaseUnits(snapshot.fee, TOKENS.STRK.decimals)} STRK`
              : "unavailable"}
          </LedgerRow>
          <LedgerRow label="Privacy pool contract">
            <a
              className="text-seal-bright underline decoration-[var(--seal-soft-2)] underline-offset-[3px] hover:decoration-[var(--seal-text)]"
              href={explorerAddressUrl(network, pool)}
              target="_blank"
              rel="noreferrer"
            >
              {`${pool.slice(0, 8)}...${pool.slice(-6)}`}
            </a>
          </LedgerRow>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-3">
        <ReadStamp network={network} block={snapshot.block} readAt={snapshot.readAt} />
        <button
          type="button"
          className={ui.tab}
          onClick={snapshot.refresh}
          disabled={snapshot.loading}
        >
          {snapshot.loading ? "Re-reading…" : "Re-read"}
        </button>
      </div>
    </section>
  );
}
