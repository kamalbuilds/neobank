"use client";
import { useState } from "react";
import { validateAndParseAddress } from "starknet";
import styles from "../../uni.module.css";
import { useStoreWallet } from "../Wallet/walletContext";
import { TOKENS, type TokenSymbol, type NetworkKey } from "@/utils/constants";
import { toBaseUnits } from "../lib/format";
import { submitStrk20, waitStrk20Transaction } from "../lib/strk20";
import { usePoolFee } from "../lib/useFee";
import TokenSelect from "./TokenSelect";
import FeeRow from "./FeeRow";
import { ResultCard, errorResult, receiptToResult, type ActionResult } from "./ActionResult";

export default function SendPanel({
  network,
  initialRecipient = "",
}: {
  network: NetworkKey;
  initialRecipient?: string;
}) {
  const myWalletAccount = useStoreWallet((s) => s.myWalletAccount);
  const strk20Capable = useStoreWallet((s) => s.strk20Capable);

  const [token, setToken] = useState<TokenSymbol>("STRK");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState(initialRecipient);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  const { fee } = usePoolFee(network);
  const tokenConfig = TOKENS[token];

  async function handleSend() {
    setResult(null);
    if (!myWalletAccount) {
      setResult(errorResult("Connect a wallet first."));
      return;
    }
    let recipientAddr: string;
    try {
      recipientAddr = validateAndParseAddress(recipient);
    } catch {
      setResult(errorResult("Enter a valid Starknet address."));
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
      { type: "transfer", token: tokenConfig.address, amount: `0x${units.toString(16)}`, recipient: recipientAddr },
    ]);
    if (!submission.ok || !submission.txHash) {
      if (submission.error?.kind === "not_registered") {
        setResult({
          status: "screened",
          title: "Recipient not registered in the privacy pool",
          note: submission.error.message,
        });
      } else {
        setResult(errorResult(submission.error?.message ?? "Action failed."));
      }
      setSubmitting(false);
      return;
    }
    const amountLabel = `${amount} ${token} (private)`;
    setResult({
      status: "pending",
      title: "Waiting for confirmation…",
      rows: [{ label: "Amount", value: amountLabel }, { label: "Transaction", value: submission.txHash, hash: submission.txHash }],
    });
    const outcome = await waitStrk20Transaction(submission.txHash, network);
    if (outcome.status === "confirmed") {
      const receipt = { execution_status: outcome.reverted ? "REVERTED" : "SUCCEEDED" };
      setResult(receiptToResult(receipt, submission.txHash, amountLabel));
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
        The recipient must already be registered in the privacy pool (they need to have used a STRK20-capable
        wallet at least once). This app cannot register them for you.
      </div>

      <div className={styles.inputBlock}>
        <div className={styles.inputLabel}>You&apos;re sending privately</div>
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
        <input
          className={styles.subMono}
          style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "10px 12px", width: "100%", marginTop: 8, background: "#fff" }}
          placeholder="Recipient address (0x…)"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
        />
      </div>

      <FeeRow fee={fee} />

      {!strk20Capable && (
        <div className={styles.warn}>This wallet does not support STRK20 privacy actions. Install or update Ready.</div>
      )}

      <button
        className={styles.btnCta}
        disabled={!strk20Capable || submitting || !amount || !recipient}
        onClick={handleSend}
      >
        {submitting ? "Sending…" : "Send privately"}
      </button>

      {result ? <ResultCard r={result} network={network} /> : null}
    </div>
  );
}
