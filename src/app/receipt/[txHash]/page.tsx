"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import {
  providerFor,
  poolAddressFor,
  explorerTxUrl,
  type NetworkKey,
} from "@/utils/constants";
import styles from "../../uni.module.css";

function isValidTxHash(hash: string): hash is `0x${string}` {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}

export default function ReceiptPage() {
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

        const txResult: any = await provider.getTransaction(txHash);
        const bn = txResult?.block_number ?? null;
        setBlockNumber(bn);

        if (bn) {
          const block = await provider.getBlock(bn);
          const ts = block?.timestamp ?? "unknown";
          setTimestamp(String(ts));
        }

        const chunk = await provider.getEvents({
          address: poolAddr,
          chunk_size: "1000",
        } as any);

        const matchingEvents = chunk.events.filter(
          (e: any) => e.transaction_hash === txHash
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
      <div className={styles.receipt} style={{ color: "var(--muted)" }}>
        No transaction hash provided
      </div>
    );
  }

  if (state === "loading") {
    return (
      <div className={styles.receipt} style={{ margin: "20px 0" }}>
        Loading…
      </div>
    );
  }

  if (state === "not-found") {
    return (
      <div
        className={styles.receipt}
        style={{
          borderColor: "var(--danger)",
          color: "var(--danger)",
        }}
      >
        <div>Receipt not found</div>
        <div>{error || "Transaction not on the STRK20 pool"}</div>
        <div>
          Make sure the transaction hash is correct and on the <code>sepolia</code>
          network.
        </div>
      </div>
    );
  }

  if (state === "verified") {
    return (
      <div className={styles.receipt} style={{ margin: "24px 0" }}>
        <div
          style={{
            fontSize: 48,
            margin: "24px 0",
            color: "var(--green)",
            textAlign: "center",
          }}
        >
          ✓
        </div>

        <div style={{ marginBottom: 16 }}>
          <strong>Settled through the STRK20 privacy pool</strong>
        </div>

        <div style={{ margin: "16px 0" }}>
          <a
            href={explorerTxUrl(netKey, txHash)}
            target="_blank"
            rel="noreferrer"
            style={{
              color: "var(--pink-text)",
              fontWeight: 600,
              fontFamily: "var(--font-mono-ui), monospace",
              textDecoration: "none",
            }}
          >
            {txHash.slice(0, 7)}…{txHash.slice(-4)}
          </a>{" on "}
          <span>{blockNumber ?? "?"}</span>
          <span> block</span>
        </div>

        <div>
          <strong>Timestamp:</strong> {timestamp}
        </div>

        <div>
          <strong>Pool events found:</strong> {eventCount}
        </div>

        <blockquote
          style={{
            margin: "16px 0",
            padding: "12px",
            background: "var(--inset)",
            borderRadius: "12px",
            color: "#24242c",
            fontFamily: "var(--font-mono-ui), monospace",
            fontSize: 12,
            lineHeight: 1.55,
          }}
        >
          Amounts, sender and recipient stay inside encrypted pool storage. This
          page proves settlement happened; it cannot show who paid whom.
        </blockquote>
      </div>
    );
  }

  return null;
}