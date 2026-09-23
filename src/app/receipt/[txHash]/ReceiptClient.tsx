"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import {
  providerFor,
  poolAddressFor,
  explorerTxUrl,
  type NetworkKey,
} from "@/utils/constants";
import { Skeleton } from "../../components/v2/ui";
import { AccountChrome } from "../../components/v2/AccountChrome";
import { DisplayFigure, DisplayRedaction } from "../../components/v2/DisplayFigure";

// Starknet prints felts with leading zeros stripped, so a real hash is 1-64
// hex digits, not always 64: the JIT settlement
// 0x1f815361cd9cb1b378f208c8def10dddf5452ead190cb199a1da37adf4fe5df is 63 and
// was rejected as malformed until this accepted short forms.
function isValidTxHash(hash: string): hash is `0x${string}` {
  return /^0x[a-fA-F0-9]{1,64}$/.test(hash);
}

/** Unix seconds from the block header, printed as the UTC instant it names. */
function utcFromBlockTimestamp(seconds: number | null): string {
  if (seconds === null) return "Not reported";
  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) return "Not reported";
  return `${date.toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

const SHEET = "paper paper-torn relative mx-auto w-full max-w-[460px] px-7 pb-7 pt-9";

function SheetHead({ title }: { title: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-paper-muted">
          Sealed
        </div>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-[24px] leading-[1.1] tracking-[-0.015em] text-paper-ink">
          {title}
        </h1>
      </div>
      <span className="figure mt-1 inline-flex shrink-0 rotate-[-3deg] items-center border border-[color:var(--seal)] px-2 py-0.5 text-[13px] font-semibold uppercase tracking-[0.1em] text-seal">
        Sepolia
      </span>
    </div>
  );
}

export function ReceiptClient() {
  const { txHash }: { txHash: string } = useParams();
  const netKey: NetworkKey = "sepolia";

  const [state, setState] =
    useState<"loading" | "verified" | "not-found" | "error">("loading");
  const [eventCount, setEventCount] = useState(0);
  const [blockNumber, setBlockNumber] = useState<number | null>(null);
  const [timestamp, setTimestamp] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      if (!txHash) {
        setState("error");
        setError("No transaction hash provided");
        mounted = false;
        return;
      }

      if (!isValidTxHash(String(txHash))) {
        setState("error");
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
          const ts = block?.timestamp;
          setTimestamp(typeof ts === "number" ? ts : null);
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
        setState("error");
        setError(e?.message ?? "Failed to query receipt");
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [txHash]);

  if (state === "loading") {
    return (
      <AccountChrome>
        <div className={SHEET} aria-busy="true" aria-label="Verifying receipt">
          <SheetHead title="Reading the pool" />
          <div className="mt-6 flex flex-col gap-2">
            <Skeleton className="skeleton-paper h-3 w-2/3" />
            <Skeleton className="skeleton-paper h-3 w-1/2" />
            <Skeleton className="skeleton-paper h-3 w-3/4" />
          </div>
          <div className="rule-paper mt-7 pt-4">
            <Skeleton className="skeleton-paper h-3 w-full" />
          </div>
        </div>
      </AccountChrome>
    );
  }

  // The node distinguishes "no such transaction" from "I could not answer".
  // Collapsing both into one failure message would tell a reader their hash is
  // broken when the node is, or the reverse.
  const unknownHash = state === "error" && /not found/i.test(error ?? "");

  if (state === "error") {
    return (
      <AccountChrome>
        <div className={SHEET}>
          <SheetHead
            title={
              unknownHash
                ? "No transaction at this hash"
                : "This receipt could not be read"
            }
          />
          <p className="mt-5 text-[15px] leading-relaxed text-paper-ink" role="alert">
            {unknownHash
              ? "Sepolia has no transaction with this hash. It may be on mainnet, or it may be mistyped."
              : error || "The Sepolia node did not answer."}
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-paper-muted">
            Nothing is being asserted about the transaction either way. Re-open the page to retry
            the read, or check the hash on Voyager.
          </p>
          {unknownHash && error ? (
            <p className="figure mt-2 break-words text-[13px] leading-relaxed text-paper-muted">
              Node said: {error}
            </p>
          ) : null}
          {txHash && isValidTxHash(String(txHash)) ? (
            <div className="rule-paper mt-6 pt-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-paper-muted">
                Transaction
              </div>
              <a
                href={explorerTxUrl(netKey, String(txHash))}
                target="_blank"
                rel="noreferrer"
                className="figure mt-2 block break-all text-[13px] font-semibold text-paper-ink underline decoration-[color:var(--paper-line)] underline-offset-4 hover:decoration-[color:var(--seal)]"
              >
                {txHash}
              </a>
            </div>
          ) : null}
        </div>
      </AccountChrome>
    );
  }

  if (state === "not-found") {
    return (
      <AccountChrome>
        <div className={SHEET}>
          <SheetHead title="Not a STRK20 pool settlement" />
          <p className="mt-5 text-[15px] leading-relaxed text-paper-ink">
            This transaction carries no event from the STRK20 privacy pool
            {blockNumber !== null ? (
              <>
                {" "}
                in block <span className="figure">{blockNumber}</span>
              </>
            ) : null}
            . It may be a public transfer, or it may be on a different network.
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-paper-muted">
            Check the hash is the one you meant and that it is on{" "}
            <span className="figure">sepolia</span>, then open it on Voyager below.
          </p>
          <div className="rule-paper mt-6 pt-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-paper-muted">
              Transaction
            </div>
            <a
              href={explorerTxUrl(netKey, txHash)}
              target="_blank"
              rel="noreferrer"
              className="figure mt-2 block break-all text-[13px] font-semibold text-paper-ink underline decoration-[color:var(--paper-line)] underline-offset-4 hover:decoration-[color:var(--seal)]"
            >
              {txHash}
            </a>
          </div>
        </div>
      </AccountChrome>
    );
  }

  return (
    <AccountChrome>
      <div className={`${SHEET} animate-rise-in`}>
        <SheetHead title="Settled through the STRK20 privacy pool" />

        {/* On a receipt the amount is the page, and on this receipt the amount
            is genuinely unreadable: it lives encrypted in pool storage and no
            RPC returns it. So the amount still gets the display step, drawn as
            the bar that is actually there rather than shrunk to a caption. A
            number would have to be invented to fill it, and none is. */}
        <DisplayFigure
          className="mt-7"
          label="Amount"
          value={<DisplayRedaction label="Amount encrypted in pool storage" width="w-[6ch]" />}
          caption="Encrypted in pool storage. The bar is the fact, not a placeholder for one: this page proves the settlement happened and cannot show what it was worth."
          provenance={`sepolia · block ${blockNumber ?? "not reported"} · ${utcFromBlockTimestamp(timestamp)}`}
        />

        <dl className="mt-7">
          <div className="rule-paper flex items-baseline justify-between gap-4 py-2.5">
            <dt className="text-[13px] text-paper-muted">Status</dt>
            <dd className="figure text-[15px] font-bold text-ledger-green">Settled</dd>
          </div>
          <div className="rule-paper flex items-baseline justify-between gap-4 py-2.5">
            <dt className="text-[13px] text-paper-muted">Block</dt>
            <dd className="figure text-[15px] font-semibold text-paper-ink">{blockNumber ?? "Not reported"}</dd>
          </div>
          <div className="rule-paper flex items-baseline justify-between gap-4 py-2.5">
            <dt className="text-[13px] text-paper-muted">
              Block time
            </dt>
            <dd className="figure text-[15px] font-semibold text-paper-ink">
              {utcFromBlockTimestamp(timestamp)}
            </dd>
          </div>
          <div className="rule-paper flex items-baseline justify-between gap-4 py-2.5">
            <dt className="text-[13px] text-paper-muted">
              Pool events found
            </dt>
            <dd className="figure text-[15px] font-semibold text-paper-ink">{eventCount}</dd>
          </div>
        </dl>

        <div className="rule-paper mt-5 pt-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-paper-muted">
            On-chain transaction
          </div>
          <a
            href={explorerTxUrl(netKey, txHash)}
            target="_blank"
            rel="noreferrer"
            className="figure mt-2 block break-all text-[13px] font-semibold text-paper-ink underline decoration-[color:var(--paper-line)] underline-offset-4 hover:decoration-[color:var(--seal)]"
          >
            {txHash}
          </a>
          <p className="mt-2 text-[13px] text-paper-muted">Opens on Voyager, Sepolia.</p>
        </div>

        <p className="mt-5 text-[13px] leading-relaxed text-paper-muted">
          Amounts, sender and recipient stay inside encrypted pool storage. This page proves
          settlement happened; it cannot show who paid whom.
        </p>
      </div>
    </AccountChrome>
  );
}
