"use client";
import { useEffect, useState } from "react";
import { ui } from "../lib/panelUi";
import { cx } from "../v2/ui";
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
    <div className={ui.panel}>
      <div className={ui.warn} style={{ color: "var(--muted)" }}>
        This is the card-funding hop, not a swipe. It burns public native USDC on Starknet via Circle CCTP V2
        and mints it on {CHAIN_LABEL[chain]}. The amount and destination are visible onchain - this hop is
        public. A Visa is issued by a partner (Stripe + Bridge), not this app; the merchant will see a card,
        not this wallet.
      </div>

      <div className={ui.inputBlock}>
        <div className={ui.inputLabel}>You&apos;re hopping</div>
        <div className={ui.inputMain}>
          <input
            className={ui.bigValue}
            placeholder="0"
            inputMode="decimal"
            aria-label="Amount of USDC to hop"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <span className={ui.subMono}>USDC</span>
        </div>

        <div className="mt-3 flex items-center gap-1.5" role="radiogroup" aria-label="Destination chain">
          {(["base", "solana"] as CctpChain[]).map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={chain === c}
              className={chain === c ? ui.tabActive : ui.tab}
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
          className={cx(ui.inputField, "mt-2 w-full")}
          aria-label={chain === "base" ? "Base mint recipient" : "Solana mint recipient"}
          placeholder={chain === "base" ? "Base mint recipient (0x… EVM address)" : "Solana mint recipient (base58 public key)"}
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
        />
      </div>

      <div className={ui.subLine}>
        <span className={ui.subMono}>
          public native USDC: {publicUsdc !== undefined ? fromBaseUnits(publicUsdc, TOKENS.USDC.decimals) : "…"}
        </span>
      </div>
      {insufficientBalance && (
        <div className={ui.warn}>Not enough public native USDC for this amount.</div>
      )}

      <div className={ui.subLine} style={{ color: "var(--muted)" }}>
        Standard Transfer (no CCTP fee, finalizes in minutes). This burns TOKENS.USDC only - bridged USDC.e
        cannot be burned here.
      </div>

      <button
        type="button"
        className={ui.btnCta}
        disabled={!myWalletAccount || submitting || !amount || !recipient || insufficientBalance}
        onClick={handleHop}
      >
        {submitting ? "Hopping…" : `Burn to ${CHAIN_LABEL[chain]}`}
      </button>

      {result ? (
        <div
          className={cx(
            ui.receipt,
            result.status === "error" ? ui.receiptError : result.status === "pending" ? ui.receiptPending : ui.receiptOk,
            "animate-rise-in",
          )}
        >
          <div className={ui.receiptHead}>
            <span
              className={cx(
                ui.receiptIcon,
                result.status === "ok"
                  ? "bg-[#34d399] shadow-[0_0_12px_rgba(52,211,153,0.55)]"
                  : result.status === "error"
                    ? "bg-[#f87171]"
                    : "bg-[#2dd4bf]",
              )}
              aria-hidden="true"
            >
              {result.status === "ok" ? "✓" : result.status === "error" ? "!" : "⋯"}
            </span>
            <span>{result.title}</span>
          </div>
          {result.rows?.length ? (
            <div className={ui.receiptRows}>
              {result.rows.map((row) => (
                <div key={row.label} className={ui.receiptRow}>
                  <span className={ui.receiptLabel}>{row.label}</span>
                  {row.hash ? (
                    <a className={ui.receiptLink} href={explorerTxUrl(network, row.hash)} target="_blank" rel="noreferrer">
                      {row.value} ↗
                    </a>
                  ) : (
                    <span className={ui.receiptValue}>{row.value}</span>
                  )}
                </div>
              ))}
            </div>
          ) : null}
          {result.note ? <pre className={ui.receiptNote}>{result.note}</pre> : null}
        </div>
      ) : null}

      {txHash && result?.status === "ok" ? (
        <div className={cx(ui.panel, "mt-3")}>
          <div className={ui.inputLabel}>Circle attestation (Iris, public API)</div>
          {attestationLoading && !attestation ? (
            <div className={ui.subMono}>Polling iris-api.circle.com for the attestation…</div>
          ) : null}
          {attestation?.status === "complete" ? (
            <>
              <div className={ui.subMono}>Attestation ready: {shortHex(attestation.attestation)}</div>
              <div className={ui.warn} style={{ color: "var(--muted)" }}>
                This app does not hold a {CHAIN_LABEL[chain]} signer. Finish the mint yourself: call
                receive_message on MessageTransmitterV2 on {CHAIN_LABEL[chain]} with this attestation and the
                message bytes from Circle&apos;s Iris API (source domain {CCTP.starknetDomain}, transaction{" "}
                {shortHex(txHash)}). No balance is minted until that call lands.
              </div>
            </>
          ) : null}
          {attestation?.status === "timeout" ? (
            <div className={ui.warn}>
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
