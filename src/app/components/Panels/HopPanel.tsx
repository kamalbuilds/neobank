"use client";
import { useEffect, useState } from "react";
import styles from "../../uni.module.css";
import { useStoreWallet } from "../Wallet/walletContext";
import { CCTP, TOKENS, getPublicBalance, explorerTxUrl, type CctpChain, type NetworkKey } from "@/utils/constants";
import { toBaseUnits, fromBaseUnits, shortHex } from "../lib/format";
import {
  buildDepositForBurnCalls,
  encodeMintRecipient,
  submitCctpBurn,
  pollCctpAttestation,
  type AttestationOutcome,
} from "../lib/cctp";
import { waitStrk20Transaction } from "../lib/strk20";
import { errorResult, type ActionResult } from "./ActionResult";

const CHAIN_LABEL: Record<CctpChain, string> = { base: "Base", solana: "Solana" };

export default function HopPanel({ network }: { network: NetworkKey }) {
  const myWalletAccount = useStoreWallet((s) => s.myWalletAccount);
  const address = useStoreWallet((s) => s.address);

  const [chain, setChain] = useState<CctpChain>("base");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [publicUsdc, setPublicUsdc] = useState<bigint | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [txHash, setTxHash] = useState<string | undefined>(undefined);
  const [attestation, setAttestation] = useState<AttestationOutcome | null>(null);
  const [attestationLoading, setAttestationLoading] = useState(false);

  useEffect(() => {
    if (!address) {
      setPublicUsdc(undefined);
      return;
    }
    let cancelled = false;
    getPublicBalance(network, TOKENS.USDC.address, address)
      .then((balance) => {
        if (!cancelled) setPublicUsdc(balance);
      })
      .catch(() => {
        if (!cancelled) setPublicUsdc(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [address, network]);

  async function handleHop() {
    setResult(null);
    setTxHash(undefined);
    setAttestation(null);
    if (!myWalletAccount || !address) {
      setResult(errorResult("Connect a wallet first."));
      return;
    }
    let units: bigint;
    try {
      units = toBaseUnits(amount, TOKENS.USDC.decimals);
    } catch (err: any) {
      setResult(errorResult(err.message));
      return;
    }
    let mintRecipient: bigint;
    try {
      mintRecipient = encodeMintRecipient(chain, recipient);
    } catch (err: any) {
      setResult(errorResult(err.message));
      return;
    }
    try {
      const balance = await getPublicBalance(network, TOKENS.USDC.address, address);
      setPublicUsdc(balance);
      if (balance < units) {
        setResult(errorResult(
          `Need ${fromBaseUnits(units, TOKENS.USDC.decimals)} public native USDC. This wallet has ${fromBaseUnits(balance, TOKENS.USDC.decimals)}.`,
        ));
        return;
      }
    } catch (err: any) {
      setResult(errorResult(err?.message ?? "Could not read public USDC balance before the burn."));
      return;
    }

    setSubmitting(true);
    const calls = buildDepositForBurnCalls({
      amount: units,
      destinationDomain: CCTP.domains[chain],
      mintRecipient,
    });
    const submission = await submitCctpBurn(myWalletAccount, calls);
    if (!submission.ok || !submission.txHash) {
      setResult(errorResult(submission.error ?? "The wallet did not accept the CCTP burn."));
      setSubmitting(false);
      return;
    }
    setTxHash(submission.txHash);
    setResult({
      status: "pending",
      title: "Waiting for confirmation…",
      rows: [
        { label: "Burning", value: `${amount} USDC -> ${CHAIN_LABEL[chain]}` },
        { label: "Transaction", value: submission.txHash, hash: submission.txHash },
      ],
    });
    const outcome = await waitStrk20Transaction(submission.txHash, network);
    if (outcome.status === "confirmed") {
      if (outcome.reverted) {
        setResult(errorResult(outcome.revertReason ?? "The burn transaction reverted."));
        setSubmitting(false);
        return;
      }
      setResult({
        status: "ok",
        title: "Burn confirmed on Starknet",
        rows: [
          { label: "Burned", value: `${amount} USDC` },
          { label: "Destination", value: `${CHAIN_LABEL[chain]} (domain ${CCTP.domains[chain]})` },
          { label: "Mint recipient", value: shortHex(`0x${mintRecipient.toString(16)}`) },
          { label: "Transaction", value: submission.txHash, hash: submission.txHash },
        ],
      });
      setAttestationLoading(true);
      const att = await pollCctpAttestation(CCTP.starknetDomain, submission.txHash);
      setAttestation(att);
      setAttestationLoading(false);
    } else if (outcome.status === "submitted") {
      setResult({
        status: "pending",
        title: "Submitted - not yet confirmed by this RPC",
        note: "Track it on the explorer. Once it lands, come back and check the attestation with the transaction hash above.",
        rows: [{ label: "Transaction", value: submission.txHash, hash: submission.txHash }],
      });
    } else {
      setResult(errorResult(outcome.message));
    }
    setSubmitting(false);
  }

  const insufficientBalance =
    publicUsdc !== undefined && amount
      ? (() => {
          try {
            return publicUsdc < toBaseUnits(amount, TOKENS.USDC.decimals);
          } catch {
            return false;
          }
        })()
      : false;

  return (
    <div className={styles.panel}>
      <div className={styles.warn} style={{ color: "var(--muted)" }}>
        This is the card-funding hop, not a swipe. It burns public native USDC on Starknet via Circle CCTP V2
        and mints it on {CHAIN_LABEL[chain]}. The amount and destination are visible onchain - this hop is
        public. A Visa is issued by a partner (Stripe + Bridge), not this app; the merchant will see a card,
        not this wallet.
      </div>

      <div className={styles.inputBlock}>
        <div className={styles.inputLabel}>You&apos;re hopping</div>
        <div className={styles.inputMain}>
          <input
            className={styles.bigValue}
            style={{ border: "none", outline: "none", background: "transparent", width: "60%" }}
            placeholder="0"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <span className={styles.subMono}>USDC</span>
        </div>

        <div className={styles.subLine} role="radiogroup" aria-label="Destination chain">
          {(["base", "solana"] as CctpChain[]).map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={chain === c}
              className={`${styles.tab} ${chain === c ? styles.tabActive : ""}`}
              onClick={() => {
                setChain(c);
                setResult(null);
              }}
            >
              {CHAIN_LABEL[c]}
            </button>
          ))}
        </div>

        <input
          className={styles.subMono}
          style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "10px 12px", width: "100%", marginTop: 8, background: "#fff" }}
          placeholder={chain === "base" ? "Base mint recipient (0x… EVM address)" : "Solana mint recipient (base58 public key)"}
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
        />
      </div>

      <div className={styles.subLine}>
        <span className={styles.subMono}>
          public native USDC: {publicUsdc !== undefined ? fromBaseUnits(publicUsdc, TOKENS.USDC.decimals) : "…"}
        </span>
      </div>
      {insufficientBalance && (
        <div className={styles.warn}>Not enough public native USDC for this amount.</div>
      )}

      <div className={styles.subLine} style={{ color: "var(--muted)" }}>
        Standard Transfer (no CCTP fee, finalizes in minutes). This burns TOKENS.USDC only - bridged USDC.e
        cannot be burned here.
      </div>

      <button
        className={styles.btnCta}
        disabled={!myWalletAccount || submitting || !amount || !recipient || insufficientBalance}
        onClick={handleHop}
      >
        {submitting ? "Hopping…" : `Burn to ${CHAIN_LABEL[chain]}`}
      </button>

      {result ? (
        <div
          className={`${styles.receipt} ${
            result.status === "error" ? styles.receiptError : result.status === "pending" ? styles.receiptPending : styles.receiptOk
          }`}
        >
          <div className={styles.receiptHead}>
            <span className={styles.receiptIcon}>{result.status === "ok" ? "✓" : result.status === "error" ? "!" : "⋯"}</span>
            <span>{result.title}</span>
          </div>
          {result.rows?.length ? (
            <div className={styles.receiptRows}>
              {result.rows.map((row) => (
                <div key={row.label} className={styles.receiptRow}>
                  <span className={styles.receiptLabel}>{row.label}</span>
                  {row.hash ? (
                    <a className={styles.receiptLink} href={explorerTxUrl(network, row.hash)} target="_blank" rel="noreferrer">
                      {row.value} ↗
                    </a>
                  ) : (
                    <span className={styles.receiptValue}>{row.value}</span>
                  )}
                </div>
              ))}
            </div>
          ) : null}
          {result.note ? <pre className={styles.receiptNote}>{result.note}</pre> : null}
        </div>
      ) : null}

      {txHash && result?.status === "ok" ? (
        <div className={styles.panel} style={{ marginTop: 12 }}>
          <div className={styles.inputLabel}>Circle attestation (Iris, public API)</div>
          {attestationLoading && !attestation ? (
            <div className={styles.subMono}>Polling iris-api.circle.com for the attestation…</div>
          ) : null}
          {attestation?.status === "complete" ? (
            <>
              <div className={styles.subMono}>Attestation ready: {shortHex(attestation.attestation)}</div>
              <div className={styles.warn} style={{ color: "var(--muted)" }}>
                This app does not hold a {CHAIN_LABEL[chain]} signer. Finish the mint yourself: call
                receive_message on MessageTransmitterV2 on {CHAIN_LABEL[chain]} with this attestation and the
                message bytes from Circle&apos;s Iris API (source domain {CCTP.starknetDomain}, transaction{" "}
                {shortHex(txHash)}). No balance is minted until that call lands.
              </div>
            </>
          ) : null}
          {attestation?.status === "timeout" ? (
            <div className={styles.warn}>
              Attestation not ready after 2 minutes of polling. Circle usually needs a few minutes for Standard
              Transfer finality - check{" "}
              <a
                href={`https://iris-api.circle.com/v2/messages/${CCTP.starknetDomain}?transactionHash=${txHash}`}
                target="_blank"
                rel="noreferrer"
              >
                this Iris URL
              </a>{" "}
              again later with this transaction hash.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
