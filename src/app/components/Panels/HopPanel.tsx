"use client";
import { useEffect, useState } from "react";
import { ui } from "../lib/panelUi";
import { cx, Figure, PanelState } from "../v2/ui";
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
import { HowThisWorks } from "../v2/ui";
import PoolFacts, { usePoolSnapshot } from "./PoolFacts";

const CHAIN_LABEL: Record<CctpChain, string> = { base: "Base", solana: "Solana" };

export default function HopPanel({ network }: { network: NetworkKey }) {
  const myWalletAccount = useStoreWallet((s) => s.myWalletAccount);
  const address = useStoreWallet((s) => s.address);

  const [chain, setChain] = useState<CctpChain>("base");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [publicUsdc, setPublicUsdc] = useState<bigint | undefined>(undefined);
  const [publicUsdcError, setPublicUsdcError] = useState<string | undefined>(undefined);
  const [publicUsdcLoading, setPublicUsdcLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [txHash, setTxHash] = useState<string | undefined>(undefined);
  const [attestation, setAttestation] = useState<AttestationOutcome | null>(null);
  const [attestationLoading, setAttestationLoading] = useState(false);
  const pool = usePoolSnapshot(network);

  useEffect(() => {
    if (!address) {
      setPublicUsdc(undefined);
      setPublicUsdcError(undefined);
      setPublicUsdcLoading(false);
      return;
    }
    let cancelled = false;
    setPublicUsdcLoading(true);
    setPublicUsdcError(undefined);
    getPublicBalance(network, TOKENS.USDC.address, address)
      .then((balance) => {
        if (!cancelled) setPublicUsdc(balance);
      })
      .catch((err: any) => {
        if (cancelled) return;
        // A failed read is not a zero balance, so it must not be allowed to
        // silently disable the button as if the wallet were empty.
        setPublicUsdc(undefined);
        setPublicUsdcError(err?.message ?? "Could not read your public USDC balance.");
      })
      .finally(() => {
        if (!cancelled) setPublicUsdcLoading(false);
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
        { label: "Sending", value: `${amount} USDC -> ${CHAIN_LABEL[chain]}` },
        { label: "Transaction", value: submission.txHash, hash: submission.txHash },
      ],
    });
    const outcome = await waitStrk20Transaction(submission.txHash, network);
    if (outcome.status === "confirmed") {
      if (outcome.reverted) {
        setResult(errorResult(outcome.revertReason ?? "The transaction reverted."));
        setSubmitting(false);
        return;
      }
      setResult({
        status: "ok",
        title: "Confirmed on Starknet",
        rows: [
          { label: "Sent", value: `${amount} USDC` },
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
        title: "Submitted, not yet confirmed by this RPC",
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
      <div>
        <h2 className={ui.heading}>Send USDC out to {CHAIN_LABEL[chain]}</h2>
        <p className={`${ui.note} mt-1.5`}>
          Send public USDC from Starknet out to {CHAIN_LABEL[chain]}. This moves money out of the
          app, not a card swipe.
        </p>
        <HowThisWorks className="mt-2">
          <p>
            This uses Circle&apos;s CCTP bridge: USDC is burned here and minted on{" "}
            {CHAIN_LABEL[chain]}. The amount and destination address are public onchain, the same
            as any transfer.
          </p>
        </HowThisWorks>
      </div>

      <div className={ui.inputBlock}>
        <label htmlFor="hop-amount" className={ui.inputLabel}>
          Amount to send out
        </label>
        <div className={ui.inputMain}>
          <input
            id="hop-amount"
            className={ui.bigValue}
            placeholder="0"
            inputMode="decimal"
            aria-label="Amount of USDC to hop"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <span className="figure text-[15px] font-semibold text-ink">USDC</span>
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
          className={cx(ui.inputField, "mt-2")}
          aria-label={chain === "base" ? "Base mint recipient" : "Solana mint recipient"}
          placeholder={chain === "base" ? "Base mint recipient (0x… EVM address)" : "Solana mint recipient (base58 public key)"}
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
        />
      </div>

      <div>
        {!address ? (
          <PanelState kind="empty" title="No account linked yet">
            The burn spends public native USDC from your own Starknet wallet, so link one and your
            balance is read and shown here before anything is submitted.
          </PanelState>
        ) : publicUsdcLoading && publicUsdc === undefined && !publicUsdcError ? (
          <PanelState kind="loading" rows={1} title="Reading your public native USDC" />
        ) : publicUsdcError ? (
          <PanelState kind="error" title="Could not read your public native USDC">
            {publicUsdcError} No figure is shown rather than a stale one, and the balance is
            re-read against the chain again just before the burn is submitted.
          </PanelState>
        ) : (
          <p className={ui.note}>
            <Figure className="text-ink">
              public native USDC:{" "}
              {publicUsdc !== undefined ? fromBaseUnits(publicUsdc, TOKENS.USDC.decimals) : "…"}
            </Figure>{" "}
            on {network === "mainnet" ? "Starknet mainnet" : "Starknet Sepolia"}.
          </p>
        )}
        {insufficientBalance && (
          <div className={`${ui.warn} mt-2`}>Not enough public native USDC for this amount.</div>
        )}
        <p className={`${ui.note} mt-2`}>
          No bridge fee, finalizes in a few minutes. Native USDC only. Bridged USDC.e isn&apos;t supported here.
        </p>
      </div>

      <button
        type="button"
        className={ui.btnCta}
        disabled={!myWalletAccount || submitting || !amount || !recipient || insufficientBalance}
        onClick={handleHop}
      >
        {submitting ? "Sending…" : `Send to ${CHAIN_LABEL[chain]}`}
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
                  ? "bg-[#2f6f4f]"
                  : result.status === "error"
                    ? "bg-[var(--seal)]"
                    : "bg-[var(--paper-muted)]",
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
          <p className="mt-3 border-t border-[var(--paper-line)] pt-2.5 text-[13px] leading-relaxed text-paper-muted">
            Burned on{" "}
            {network === "mainnet" ? (
              <span className="figure font-semibold text-paper-ink">Starknet mainnet</span>
            ) : (
              <span className="figure">Starknet Sepolia</span>
            )}
            , minting on {CHAIN_LABEL[chain]}. Every hash above opens on Voyager.
          </p>
        </div>
      ) : null}

      {txHash && result?.status === "ok" ? (
        <section className="doc p-4 sm:p-5">
          <h3 className={`${ui.caption} border-b-[3px] border-double border-[var(--line-strong)] pb-2.5`}>
            Finishing on {CHAIN_LABEL[chain]}
          </h3>
          {attestationLoading && !attestation ? (
            <PanelState
              kind="loading"
              rows={1}
              title={`Waiting on Circle to attest the transfer to ${CHAIN_LABEL[chain]}`}
              className="mt-3"
            />
          ) : null}
          {attestation?.status === "complete" ? (
            <>
              <p className={`${ui.note} mt-3`}>
                Ready to complete on {CHAIN_LABEL[chain]}. This app doesn&apos;t hold a signer on{" "}
                {CHAIN_LABEL[chain]}, so you finish the mint from a {CHAIN_LABEL[chain]} wallet. Nothing
                lands until that step runs.
              </p>
              <HowThisWorks className="mt-2" label="Call details for a wallet or script">
                <p>
                  Call <Figure className="text-ink">receive_message</Figure> on MessageTransmitterV2 on{" "}
                  {CHAIN_LABEL[chain]} with this attestation (
                  <Figure className="text-ink">{shortHex(attestation.attestation)}</Figure>) and the
                  message bytes from Circle&apos;s Iris API (source domain{" "}
                  <Figure className="text-ink">{CCTP.starknetDomain}</Figure>, transaction{" "}
                  <Figure className="text-ink">{shortHex(txHash)}</Figure>).
                </p>
              </HowThisWorks>
            </>
          ) : null}
          {attestation?.status === "timeout" ? (
            <div className={`${ui.warn} mt-3`}>
              Still waiting on Circle after 2 minutes, which is normal for this transfer type. Check{" "}
              <a
                href={`https://iris-api.circle.com/v2/messages/${CCTP.starknetDomain}?transactionHash=${txHash}`}
                target="_blank"
                rel="noreferrer"
              >
                status here
              </a>{" "}
              again shortly.
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Reads with no wallet connected, so this panel is never an empty shell. */}
      <PoolFacts network={network} snapshot={pool} />
    </div>
  );
}
