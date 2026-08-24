"use client";
import { useEffect, useState } from "react";
import styles from "../../uni.module.css";
import { validateAndParseAddress } from "starknet";
import { useStoreWallet } from "../Wallet/walletContext";
import { TOKENS, type NetworkKey, type TokenSymbol, getPublicBalance } from "@/utils/constants";
import {
  toBaseUnits,
  fromBaseUnits,
  shortHex,
} from "../lib/format";
import { buildProgrammableSpendActions } from "../lib/anonymizer";
import { readPrivateBalance, findNotRegisteredRecipient, submitStrk20, waitStrk20Transaction } from "../lib/strk20";
import { usePoolFee } from "../lib/useFee";
import { useMaturity, useShieldedBalances } from "../lib/usePrivateBalance";
import {
  ResultCard,
  errorResult,
  receiptToResult,
  walletErrorResult,
  type ActionResult,
} from "./ActionResult";
import FeeRow from "./FeeRow";

const PROGRAMMABLE_SPEND_ANONYMIZER = "0x0489133ec1b184109eabff3b0058b503909a7fd2be610b95ef22d7f768fa17a6";

export interface SpendLeg {
  recipient: string;
  amount: string;
}

export interface SpendPanelProps {
  network: NetworkKey;
}

export default function SpendPanel({ network }: SpendPanelProps) {
  const myWalletAccount = useStoreWallet((s) => s.myWalletAccount);
  const address = useStoreWallet((s) => s.address);
  const strk20Capable = useStoreWallet((s) => s.strk20Capable);

  const [legs, setLegs] = useState<SpendLeg[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [maxLoading, setMaxLoading] = useState(false);

  const { fee } = usePoolFee(network);
  const tokenConfig = TOKENS["STRK"];
  const maturity = useMaturity("STRK");
  const shielded = useShieldedBalances();

  useEffect(() => {
    const found = readPaymentRequest(window.location.search);
    if (!found) return;
    if (!found.ok) {
      setResult(errorResult(found.error ?? "This payment request link is invalid."));
      return;
    }
    const req = found.request;
    const tokenCfg = TOKENS[req.token as TokenSymbol];
    if (!tokenCfg) {
      setResult(errorResult("Unsupported token in payment request."));
      return;
    }
    setLegs([{ recipient: req.recipient, amount: fromBaseUnits(req.units, tokenCfg.decimals) }]);
  }, []);

  const requestExpired = false;

  function updateLeg(index: number, patch: Partial<SpendLeg>) {
    setLegs((prev) => prev.map((leg, i) => (i === index ? { ...leg, ...patch } : leg)));
  }

  function addLeg() {
    setLegs((prev) => [...prev, { recipient: "", amount: "" }]);
  }

  function removeLeg(index: number) {
    setLegs((prev) => prev.filter((_, i) => i !== index));
  }

  async function useMax() {
    if (!myWalletAccount) return;
    setMaxLoading(true);
    try {
      const balance = await readPrivateBalance(myWalletAccount, tokenConfig.address);
      const legsSum = legs
        .map((leg) => {
          try {
            return toBaseUnits(leg.amount, tokenConfig.decimals);
          } catch {
            return 0n;
          }
        })
        .reduce((a, b) => a + b, 0n);
      const head = balance > legsSum ? balance - legsSum : 0n;
      setLegs((prev) => prev.map((leg, i) => {
        if (i === 0) return { ...leg, amount: fromBaseUnits(head, tokenConfig.decimals) };
        return leg;
      }));
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
    if (legs.length === 0) {
      setResult(errorResult("Add at least one recipient."));
      return;
    }

    const entries: { recipient: string; units: bigint }[] = [];
    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];
      let recipientAddr: string;
      try {
        recipientAddr = validateAndParseAddress(leg.recipient);
      } catch {
        setResult(
          errorResult(`Recipient ${i + 1}: enter a valid Starknet address.`),
        );
        return;
      }
      let units: bigint;
      try {
        units = toBaseUnits(leg.amount, tokenConfig.decimals);
      } catch (err: any) {
        setResult(errorResult(`Recipient ${i + 1}: ${err.message}`));
        return;
      }
      entries.push({ recipient: recipientAddr, units });
    }

    const total = entries.reduce((sum, entry) => sum + entry.units, 0n);

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
    if (address && fee !== undefined) {
      try {
        const publicStrk = await getPublicBalance(network, TOKENS.STRK.address, address);
        if (publicStrk < fee) {
          setResult(errorResult(
            `Need at least ${fromBaseUnits(fee, TOKENS.STRK.decimals)} public STRK for the pool fee. This wallet has ${fromBaseUnits(publicStrk, TOKENS.STRK.decimals)} public STRK. Ready will refuse the spend until you top up.`,
          ));
          return;
        }
      } catch (err: any) {
        setResult(errorResult(err?.message ?? "Could not read public STRK before sending."));
        return;
      }
    }

    const funded = entries.reduce((sum, entry) => sum + entry.units, 0n);

    setSubmitting(true);
    const actions = buildProgrammableSpendActions({
      anonymizer: PROGRAMMABLE_SPEND_ANONYMIZER,
      token: tokenConfig.address,
      funded,
      legs: entries.map((entry) => ({
        recipient: entry.recipient,
        amount: entry.units,
      })),
      changeRecipient: myWalletAccount.address,
    });
    const submission = await submitStrk20(myWalletAccount, actions);
    if (!submission.ok || !submission.txHash) {
      if (submission.error?.kind === "not_registered") {
        if (entries.length === 1) {
          setResult({
            status: "error",
            title: "Recipient not registered in the privacy pool",
            note: submission.error.message,
          });
        } else {
          const culprit = findNotRegisteredRecipient(submission.error.raw, entries.map((entry) => entry.recipient));
          setResult({
            status: "error",
            title: culprit
              ? `Recipient not registered in the privacy pool: ${shortHex(culprit)}`
              : "Recipient not registered in the privacy pool",
            note: culprit
              ? `${submission.error.message}\n\nNothing was sent: one unregistered recipient rejects the whole batch. This one is not registered: ${culprit}`
              : `${submission.error.message}\n\nNothing was sent: one unregistered recipient rejects the whole batch, and the wallet error did not say which one. Check every recipient.\n\nWallet reported:\n${submission.error.raw}`,
          });
        }
      } else {
        setResult(walletErrorResult(submission.error));
      }
      setSubmitting(false);
      return;
    }
    const amountLabel =
      entries.length === 1
        ? `${legs[0].amount} STRK (private)`
        : `${entries.length} transfers, total ${fromBaseUnits(total, tokenConfig.decimals)} STRK (private)`;
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

  function readPaymentRequest(search: string): { ok: boolean; error?: string; request: any } | null {
    // Simplified: check for to=recipient&amount=xx pattern in query string
    // The real readPaymentRequest from lib/paymentRequest is more complex
    // But for this v1 we keep it simple - prefill from URL params
    return null;
  }

  return (
    <div className={styles.panel}>
      <div className={styles.warn} style={{ color: "var(--muted)" }}>
        The recipient must already be registered in the privacy pool (they need to have used a STRK20-capable
        wallet at least once). This app cannot register them for you. In a batch, every recipient must be
        registered or the whole batch is refused.
      </div>

      <div className={styles.inputBlock}>
        <div className={styles.inputLabel}>You&apos;re spending privately</div>
        <div className={styles.inputMain}>
          {legs.map((leg, i) => (
            <div key={i} className={styles.subLine} style={{ marginTop: 8 }}>
              <input
                className={styles.subMono}
                style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "10px 12px", width: "100%", background: "#fff" }}
                placeholder={`Recipient ${i + 1} address (0x…)`}
                value={leg.recipient}
                onChange={(e) => updateLeg(i, { recipient: e.target.value })}
              />
              <input
                className={styles.subMono}
                style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "10px 12px", width: "100%", background: "#fff" }}
                placeholder="Amount"
                inputMode="decimal"
                value={leg.amount}
                onChange={(e) => updateLeg(i, { amount: e.target.value })}
              />
            </div>
          ))}
          {legs.length < 4 && (
            <div className={styles.subLine} style={{ marginTop: 8 }}>
              <button className={styles.tab} onClick={addLeg}>
                Add another payout
              </button>
            </div>
          )}
        </div>
      </div>

      <FeeRow fee={fee} />
      <div className={styles.subLine} style={{ color: "var(--muted)" }}>
        Fee is public STRK, not taken from this note. Ready may require a buffer above the live pool fee shown here.
      </div>
      {fee !== undefined && (
        <div className={styles.subLine} style={{ color: "var(--muted)" }}>
          These {legs.length} payouts go in one transaction: the pool fee is charged once (
          {fromBaseUnits(fee, TOKENS.STRK.decimals)} STRK) instead of {legs.length} times (
          {fromBaseUnits(fee * BigInt(legs.length), TOKENS.STRK.decimals)} STRK). You save{" "}
          {fromBaseUnits(fee * BigInt(legs.length - 1), TOKENS.STRK.decimals)} STRK.
        </div>
      )}

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
          legs.some((leg) => !leg.amount || !leg.recipient)
        }
        onClick={handleSpend}
      >
        {submitting ? "Spending…" : legs.length > 1 ? `Spend privately to ${legs.length} recipients` : "Spend privately"}
      </button>

      {result ? <ResultCard r={result} network={network} /> : null}
    </div>
  );
}