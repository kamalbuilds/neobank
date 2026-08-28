"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import {
  providerFor,
  poolAddressFor,
  explorerTxUrl,
  type NetworkKey,
} from "@/utils/constants";
import { ui } from "../../components/lib/panelUi";
import { cx, Skeleton } from "../../components/v2/ui";
import { AccountChrome } from "../../components/v2/AccountChrome";

// Starknet prints felts with leading zeros stripped, so a real hash is 1-64
// hex digits, not always 64: the JIT settlement
// 0x1f815361cd9cb1b378f208c8def10dddf5452ead190cb199a1da37adf4fe5df is 63 and
// was rejected as malformed until this accepted short forms.
function isValidTxHash(hash: string): hash is `0x${string}` {
  return /^0x[a-fA-F0-9]{1,64}$/.test(hash);
}

export function ReceiptClient() {
  const { txHash }: { txHash: string } = useParams();
  const netKey: NetworkKey = "sepolia";

  const [state, setState] =
    useState<"loading" | "verified" | "not-found">("loading");
  const [eventCount, setEventCount] = useState(0);
  const [blockNumber, setBlockNumber] = useState<number | null>(null);
  const [timestamp, setTimestamp] = useState<string>("...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      if (!txHash) {
        setState("not-found");
        setError("No transaction hash provided");
        mounted = false;
        return;
      }

      if (!isValidTxHash(String(txHash))) {
        setState("not-found");
        setError("Malformed transaction hash");
        mounted = false;
        return;
      }

      setState("loading");

      try {
        const provider = providerFor(netKey);
        const poolAddr = poolAddressFor(netKey);

        // The block number lives on the receipt, not the transaction:
        // starknet_getTransactionByHash omits it, so reading it from
        // getTransaction left every lookup unscoped.
        const receipt: any = await provider.getTransactionReceipt(txHash);
        const bn = receipt?.block_number ?? null;
        setBlockNumber(bn);

        if (bn) {
          const block = await provider.getBlock(bn);
          const ts = block?.timestamp ?? "unknown";
          setTimestamp(String(ts));
        }

        // Scope the scan to the transaction's own block. An unbounded
        // getEvents starts at genesis and returns the first chunk, so a recent
        // transaction was never in the window and every receipt read
        // "not on the STRK20 pool".
        const chunk = await provider.getEvents({
          address: poolAddr,
          chunk_size: 1000,
          ...(bn === null ? {} : { from_block: { block_number: bn }, to_block: { block_number: bn } }),
        } as any);

        // Compare as felts: the RPC pads hashes to 64 hex digits while the URL
        // carries the stripped form, so a string equality check never matched.
        const wanted = BigInt(txHash);
        const matchingEvents = chunk.events.filter(
          (e: any) => BigInt(e.transaction_hash) === wanted
        );
        setEventCount(matchingEvents.length);

        setState(
          matchingEvents.length > 0 ? "verified" : "not-found"
        );
      } catch (e: any) {
        console.error(e);
        setState("not-found");
        setError(e.message ?? "Failed to query receipt");
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [txHash]);

  if (!txHash) {
    return (
      <AccountChrome>
        <div className={ui.panel}>
          <div className={ui.warn}>No transaction hash provided.</div>
        </div>
      </AccountChrome>
    );
  }

  if (state === "loading") {
    return (
      <AccountChrome>
        <div className={cx(ui.panel, "flex flex-col gap-3")} aria-busy="true" aria-label="Verifying receipt">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </AccountChrome>
    );
  }

  if (state === "not-found") {
    return (
      <AccountChrome>
        <div className={cx(ui.receipt, ui.receiptError, "mx-auto max-w-[520px]")}>
          <div className={ui.receiptHead}>Receipt not found</div>
          <p className="mt-2 text-[13px] leading-relaxed text-[#f0a8a8]">
            {error || "Transaction not on the STRK20 pool."}
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-[#7a859c]">
            Make sure the transaction hash is correct and on the <code>sepolia</code> network.
          </p>
        </div>
      </AccountChrome>
    );
  }

  if (state === "verified") {
    return (
      <AccountChrome>
        <div className={cx(ui.receipt, ui.receiptOk, "mx-auto max-w-[520px] animate-rise-in")}>
          <div
            className={cx(ui.receiptIcon, "mx-auto size-12 bg-[#34d399] text-2xl shadow-[0_0_20px_rgba(52,211,153,0.55)]")}
            aria-hidden="true"
          >
            ✓
          </div>

          <div className={cx(ui.receiptHead, "mt-4 justify-center")}>
            Settled through the STRK20 privacy pool
          </div>

          <div className="mt-4 text-center text-[13px] text-[#a3acbd]">
            <a href={explorerTxUrl(netKey, txHash)} target="_blank" rel="noreferrer" className={ui.receiptLink}>
              {txHash.slice(0, 7)}…{txHash.slice(-4)}
            </a>{" "}
            on block {blockNumber ?? "?"}
          </div>

          <div className={ui.receiptRows}>
            <div className={ui.receiptRow}>
              <span className={ui.receiptLabel}>Timestamp</span>
              <span className={ui.receiptValue}>{timestamp}</span>
            </div>
            <div className={ui.receiptRow}>
              <span className={ui.receiptLabel}>Pool events found</span>
              <span className={ui.receiptValue}>{eventCount}</span>
            </div>
          </div>

          <blockquote className={ui.receiptNote}>
            Amounts, sender and recipient stay inside encrypted pool storage. This
            page proves settlement happened; it cannot show who paid whom.
          </blockquote>
        </div>
      </AccountChrome>
    );
  }

  return null;
}
