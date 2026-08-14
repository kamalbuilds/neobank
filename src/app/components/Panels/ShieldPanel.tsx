"use client";
import { useState } from "react";
import styles from "../../uni.module.css";
import { useStoreWallet } from "../Wallet/walletContext";
import { TOKENS, getPublicBalance, type TokenSymbol, type NetworkKey } from "@/utils/constants";
import { toBaseUnits, fromBaseUnits } from "../lib/format";
import { submitStrk20, waitStrk20Transaction, isScreeningRevert } from "../lib/strk20";
import { usePoolFee } from "../lib/useFee";
import TokenSelect from "./TokenSelect";
import FeeRow from "./FeeRow";
import { ResultCard, errorResult, receiptToResult, type ActionResult } from "./ActionResult";

export default function ShieldPanel({ network }: { network: NetworkKey }) {
  const myWalletAccount = useStoreWallet((s) => s.myWalletAccount);
  const address = useStoreWallet((s) => s.address);
  const strk20Capable = useStoreWallet((s) => s.strk20Capable);

  const [token, setToken] = useState<TokenSymbol>("STRK");
  const [amount, setAmount] = useState("");
  const [maxLoading, setMaxLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  const { fee } = usePoolFee(network);
  const tokenConfig = TOKENS[token];

  async function useMax() {
    if (!address) return;
    setMaxLoading(true);
    try {
      const balance = await getPublicBalance(network, tokenConfig.address, address);
      const feeInThisToken = token === "STRK" ? fee ?? 0n : 0n;
      const max = balance > feeInThisToken ? balance - feeInThisToken : 0n;
      setAmount(fromBaseUnits(max, tokenConfig.decimals));
    } catch (err: any) {
      setResult(errorResult(err?.message ?? "Could not read your public balance."));
    } finally {
      setMaxLoading(false);
    }
  }

  async function handleShield() {
    setResult(null);
    if (!myWalletAccount) {
      setResult(errorResult("Connect a wallet first."));
      return;
    }
    let units: bigint;
    try {
      units = toBaseUnits(amount, tokenConfig.decimals);
    } catch (err: any) {
      setResult(errorResult(err.message));
      return;
    }
    setSubmitting(true);
    const submission = await submitStrk20(myWalletAccount, [
      { type: "deposit", token: tokenConfig.address, amount: `0x${units.toString(16)}` },
    ]);
    if (!submission.ok || !submission.txHash) {
      setResult(errorResult(submission.error?.message ?? "Action failed."));
      setSubmitting(false);
      return;
    }
    const amountLabel = `${amount} ${token}`;
    setResult({
      status: "pending",
      title: "Confirm the deposit in your wallet, then waiting for confirmation…",
      rows: [{ label: "Amount", value: amountLabel }, { label: "Transaction", value: submission.txHash, hash: submission.txHash }],
    });
    const outcome = await waitStrk20Transaction(submission.txHash, network);
    if (outcome.status === "confirmed") {
      if (outcome.reverted && isScreeningRevert(outcome.revertReason)) {
        setResult({
          status: "screened",
          title: "Deposit declined by pool screening",
          note: "This was declined by the protocol's on-chain deposit screening, not an app error. Screening applies on every route.",
          rows: [{ label: "Transaction", value: submission.txHash, hash: submission.txHash }],
        });
      } else {
        const receipt = { execution_status: outcome.reverted ? "REVERTED" : "SUCCEEDED" };
        setResult(receiptToResult(receipt, submission.txHash, amountLabel));
      }
    } else if (outcome.status === "submitted") {
      setResult({
        status: "pending",
        title: "Submitted - not yet confirmed by this RPC",
        note: "Paymaster-relayed transactions can take a while to surface. Track it on the explorer.",
        rows: [{ label: "Transaction", value: submission.txHash, hash: submission.txHash }],
      });
    } else {
      setResult(errorResult(outcome.message));
    }
    setSubmitting(false);
  }

  return (
    <div className={styles.panel}>
      <div className={styles.warn} style={{ color: "var(--muted)" }}>
        Shielding is two wallet prompts: a public ERC-20 approve, then the private deposit. Once shielded,
        notes take about 10 blocks to mature - do not plan to spend them immediately.
      </div>

      <div className={styles.inputBlock}>
        <div className={styles.inputLabel}>You&apos;re shielding</div>
        <div className={styles.inputMain}>
          <input
            className={styles.bigValue}
            style={{ border: "none", outline: "none", background: "transparent", width: "60%" }}
            placeholder="0"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <TokenSelect value={token} onChange={setToken} />
        </div>
        <div className={styles.subLine}>
          <button className={styles.tab} onClick={useMax} disabled={maxLoading || !address}>
            {maxLoading ? "reading balance…" : "Use max (public balance minus fee)"}
          </button>
        </div>
      </div>

      <FeeRow fee={fee} />

      {!strk20Capable && (
        <div className={styles.warn}>This wallet does not support STRK20 privacy actions. Install or update Ready.</div>
      )}

      <button
        className={styles.btnCta}
        disabled={!strk20Capable || submitting || !amount}
        onClick={handleShield}
      >
        {submitting ? "Shielding…" : "Shield"}
      </button>

      {result ? <ResultCard r={result} network={network} /> : null}
    </div>
  );
}
