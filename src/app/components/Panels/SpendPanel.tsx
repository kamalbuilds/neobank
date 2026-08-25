"use client";
import { useEffect, useState } from "react";
import styles from "../../uni.module.css";
import { validateAndParseAddress } from "starknet";
import { useStoreWallet } from "../Wallet/walletContext";
import {
  TOKENS,
  type NetworkKey,
  type TokenSymbol,
} from "@/utils/constants";
import {
  toBaseUnits,
  fromBaseUnits,
} from "../lib/format";
import { isExpired, readPaymentRequest } from "../lib/paymentRequest";
import { readPrivateBalance, submitStrk20, waitStrk20Transaction } from "../lib/strk20";
import { usePoolFee } from "../lib/useFee";
import { useMaturity } from "../lib/usePrivateBalance";
import {
  ResultCard,
  errorResult,
  receiptToResult,
  walletErrorResult,
  type ActionResult,
} from "./ActionResult";
import FeeRow from "./FeeRow";

export interface SpendLeg {
  recipient: string;
  amount: string;
}

export interface SpendPanelProps {
  network: NetworkKey;
}

export default function SpendPanel({ network }: SpendPanelProps) {
  const myWalletAccount = useStoreWallet((s) => s.myWalletAccount);
  const strk20Capable = useStoreWallet((s) => s.strk20Capable);

  const [legs, setLegs] = useState<SpendLeg[]>([{ recipient: "", amount: "" }]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [maxLoading, setMaxLoading] = useState(false);

  const { fee } = usePoolFee(network);
  const tokenConfig = TOKENS["STRK"];
  const maturity = useMaturity("STRK");

  useEffect(() => {
    const found = readPaymentRequest(window.location.search);
    if (!found) return;
    if (!found.ok) {
      setResult(errorResult(found.error ?? "This payment request link is invalid."));
      return;
    }
    const req = found.request;
    if (isExpired(req)) {
      setResult(errorResult("This payment request has expired."));
      return;
    }
    const tokenCfg = TOKENS[req.token as TokenSymbol];
    if (!tokenCfg) {
      setResult(errorResult("Unsupported token in payment request."));
      return;
    }
    setLegs([{ recipient: req.recipient, amount: fromBaseUnits(req.units, tokenCfg.decimals) }]);
  }, []);

  function updateLeg(patch: Partial<SpendLeg>) {
    setLegs((prev) => [{ ...prev[0], ...patch }]);
  }

  async function useMax() {
    if (!myWalletAccount) return;
    setMaxLoading(true);
    try {
      const balance = await readPrivateBalance(myWalletAccount, tokenConfig.address);
      setLegs((prev) => [{ ...prev[0], amount: fromBaseUnits(balance, tokenConfig.decimals) }]);
    } catch (err: any) {
      setResult(errorResult(err?.message ?? "Could not read your shielded balance."));
    } finally {
      setMaxLoading(false);
    }
  }

  async function handleSpend() {
    setResult(null);
    if (!myWalletAccount) {
      setResult(errorResult("Connect a wallet first."));
      return;
    }
    const leg = legs[0];
    let recipient: string;
    try {
      recipient = validateAndParseAddress(leg.recipient);
    } catch {
      setResult(errorResult("Enter a valid Starknet settlement address."));
      return;
    }
    let total: bigint;
    try {
      total = toBaseUnits(leg.amount, tokenConfig.decimals);
    } catch (err: any) {
      setResult(errorResult(err.message));
      return;
    }

    let privateUnits: bigint;
    try {
      privateUnits = await readPrivateBalance(myWalletAccount, tokenConfig.address);
    } catch (err: any) {
      setResult(errorResult(err?.message ?? "Could not read your shielded balance."));
      return;
    }
    if (total > privateUnits) {
      setResult(
        errorResult(
          `This spend sends ${fromBaseUnits(total, tokenConfig.decimals)} STRK but you have ${fromBaseUnits(
            privateUnits,
            tokenConfig.decimals,
          )} shielded STRK. Reduce the amounts and try again.`,
        ),
      );
      return;
    }
    setSubmitting(true);
    const actions = [{
      type: "withdraw" as const,
      token: tokenConfig.address,
      amount: `0x${total.toString(16)}`,
      recipient,
    }];
    const submission = await submitStrk20(myWalletAccount, actions);
    if (!submission.ok || !submission.txHash) {
      setResult(walletErrorResult(submission.error));
      setSubmitting(false);
      return;
    }
    const amountLabel = `${leg.amount} STRK from shielded funds`;
    setResult({
      status: "pending",
      title: "Waiting for confirmation…",
      rows: [{ label: "Amount", value: amountLabel }, { label: "Transaction", value: submission.txHash, hash: submission.txHash }],
    });
    const outcome = await waitStrk20Transaction(submission.txHash, network);
    if (outcome.status === "confirmed") {
      setResult(receiptToResult(outcome.receipt, submission.txHash, amountLabel));
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
        The settlement address and amount are public, like a normal card settlement. The payer and their
        remaining balance stay hidden behind the STRK20 pool.
      </div>

      <div className={styles.inputBlock}>
        <div className={styles.inputLabel}>You&apos;re spending privately</div>
        <div className={styles.inputMain}>
          <div className={styles.subLine} style={{ marginTop: 8 }}>
            <input
              className={styles.subMono}
              style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "10px 12px", width: "100%" }}
              placeholder="Acquirer or merchant address (0x…)"
              value={legs[0].recipient}
              onChange={(e) => updateLeg({ recipient: e.target.value })}
            />
            <input
              className={styles.subMono}
              style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "10px 12px", width: "100%" }}
              placeholder="Purchase amount"
              inputMode="decimal"
              value={legs[0].amount}
              onChange={(e) => updateLeg({ amount: e.target.value })}
            />
          </div>
        </div>
      </div>

      <FeeRow fee={fee} />
      <div className={styles.subLine} style={{ color: "var(--muted)" }}>
        Ready shows the settlement amount and STRK pool fee before you approve.
      </div>
      <div className={styles.subLine}>
        <button className={styles.tab} onClick={useMax} disabled={maxLoading || !myWalletAccount}>
          {maxLoading ? "reading shielded balance…" : "Use max"}
        </button>
      </div>

      {!strk20Capable && (
        <div className={styles.warn}>This wallet does not support STRK20 privacy actions. Install or update Ready.</div>
      )}
      {maturity.locked && (
        <div className={styles.warn}>
          {maturity.blocksRemaining === undefined
            ? `Notes from your last STRK shield mature about 10 blocks after the deposit.`
            : `Notes from your last STRK shield are still maturing: ~${maturity.blocksRemaining} block${
                maturity.blocksRemaining === 1 ? "" : "s"
              } left before they can be spent.`}
        </div>
      )}

      <button
        className={styles.btnCta}
        disabled={
          !strk20Capable ||
          submitting ||
          maturity.locked ||
          !legs[0].amount ||
          !legs[0].recipient
        }
        onClick={handleSpend}
      >
        {submitting ? "Settling…" : "Settle privately"}
      </button>

      {result ? <ResultCard r={result} network={network} /> : null}
    </div>
  );
}
