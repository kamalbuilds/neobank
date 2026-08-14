"use client";
import { useState } from "react";
import styles from "../../uni.module.css";
import { useStoreWallet } from "../Wallet/walletContext";
import { TOKENS, getPublicBalance, type TokenSymbol, type NetworkKey } from "@/utils/constants";
import { toBaseUnits, fromBaseUnits } from "../lib/format";
import { submitConnectedShield, waitStrk20Transaction, isScreeningRevert } from "../lib/strk20";
import { usePoolFee } from "../lib/useFee";
import TokenSelect from "./TokenSelect";
import FeeRow from "./FeeRow";
import { ResultCard, errorResult, receiptToResult, walletErrorResult, type ActionResult } from "./ActionResult";

// Matches the pool's documented note-maturity window. Applied to a real
// receipt block_number - never used to fabricate a countdown on its own.
const MATURITY_BLOCKS = 10;

export default function ShieldPanel({ network }: { network: NetworkKey }) {
  const myWalletAccount = useStoreWallet((s) => s.myWalletAccount);
  const wallet = useStoreWallet((s) => s.StarknetWalletObject);
  const address = useStoreWallet((s) => s.address);
  const strk20Capable = useStoreWallet((s) => s.strk20Capable);
  const setMaturity = useStoreWallet((s) => s.setMaturity);

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
    if (!wallet) {
      setResult(errorResult("Connect a wallet first."));
      return;
    }
    if (fee === undefined || fee === null) {
      setResult(errorResult("Could not read the pool fee. Try again."));
      return;
    }
    let publicStrk: bigint;
    try {
      publicStrk = await getPublicBalance(network, TOKENS.STRK.address, myWalletAccount.address);
    } catch (err: any) {
      setResult(errorResult(err?.message ?? "Could not read your public STRK balance."));
      return;
    }
    if (publicStrk < fee) {
      setResult(
        errorResult(
          `You need at least ${fromBaseUnits(fee, TOKENS.STRK.decimals)} public STRK to cover the pool fee` +
            `${token === "STRK" ? " on top of the amount you're shielding" : ""}. Your wallet has ${fromBaseUnits(publicStrk, TOKENS.STRK.decimals)} STRK. Top up and try again.`
        )
      );
      return;
    }
    setSubmitting(true);
    setResult({
      status: "pending",
      title: "Asking the wallet to deploy if needed, then shield…",
      note: "First privacy use is two wallet txs: deploy the account, then the public deposit that registers you in the pool.",
    });
    const submission = await submitConnectedShield(myWalletAccount, wallet, network, [
      { type: "deposit", token: tokenConfig.address, amount: `0x${units.toString(16)}` },
    ]);
    if (!submission.ok || !submission.txHash) {
      setResult(walletErrorResult(submission.error));
      setSubmitting(false);
      return;
    }
    const amountLabel = `${amount} ${token} (public deposit)`;
    const rows = [
      { label: "Amount", value: amountLabel },
      { label: "Transaction", value: submission.txHash, hash: submission.txHash },
    ];
    if (submission.deployTxHash) {
      rows.unshift({ label: "Account deploy", value: submission.deployTxHash, hash: submission.deployTxHash });
    }
    setResult({
      status: "pending",
      title: "Deposit submitted. Waiting for confirmation…",
      rows,
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
        setResult(receiptToResult(outcome.receipt, submission.txHash, amountLabel));
        const blockNumber = (outcome.receipt as { block_number?: number })?.block_number;
        if (typeof blockNumber === "number") {
          setMaturity(token, blockNumber + MATURITY_BLOCKS);
        }
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
        First privacy use in this app deploys the account if it is still counterfactual, then shields.
        That is the same pair of txs as Ready&apos;s Activate and Enable private tokens. After that:
        two wallet prompts (public approve, then deposit). The deposit is public. Notes take about 10
        blocks to mature.
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

      {token === "USDC" && (
        <div className={styles.warn} style={{ color: "var(--muted)" }}>
          The pool fee is still public STRK, paid from your wallet, not deducted from this deposit. Separately,
          Ready has been observed reserving a small amount from the shielded asset itself (0.2 USDC in resulted
          in 0.0395 USDC noted) - that reservation is wallet-side behavior we&apos;ve seen, not a fee this app
          charges or a formula we can guarantee.
        </div>
      )}

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
