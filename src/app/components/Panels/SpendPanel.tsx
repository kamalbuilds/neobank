"use client";
import { useEffect, useState } from "react";
import { ui } from "../lib/panelUi";
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
import { useMaturity } from "../lib/usePrivateBalance";
import {
  ResultCard,
  errorResult,
  receiptToResult,
  walletErrorResult,
  type ActionResult,
} from "./ActionResult";
import FeeRow from "./FeeRow";
import { HowThisWorks } from "../v2/ui";
import PoolFacts, { usePoolSnapshot } from "./PoolFacts";
import VerbEvidence, { receiptsFor } from "./VerbEvidence";

/**
 * The three card authorizations that have actually settled from a shielded
 * balance. This is the verb the whole product is built around, so a reader who
 * lands here with no wallet gets the receipts before the form, not after it.
 */
const SWIPE_RECEIPTS = receiptsFor([
  "0x1f815361cd9cb1b378f208c8def10dddf5452ead190cb199a1da37adf4fe5df",
  "0x48ccd889292f406734d97a27c53db53910fb0f9ef3c056668bd64e20ccb111b",
  "0x063b3fe7e13e9baca4d0a9ca9616b7b5e71504b38ed02bb3b98512935988acf4",
]);

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

  const [legs, setLegs] = useState<SpendLeg[]>([{ recipient: "", amount: "" }]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [maxLoading, setMaxLoading] = useState(false);

  const pool = usePoolSnapshot(network);
  const fee = pool.fee;
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
        title: "Submitted, not yet confirmed by this RPC",
        note: "Paymaster-relayed transactions can take a while to surface. Track it on the explorer.",
        rows: [{ label: "Transaction", value: submission.txHash, hash: submission.txHash }],
      });
    } else {
      setResult(errorResult(outcome.message));
    }
    setSubmitting(false);
  }

  return (
    <div className={ui.panel}>
      <div>
        <h2 className={ui.heading}>Settle a payment</h2>
        <p className={`${ui.note} mt-1.5`}>
          Pay a merchant or acquirer directly from your shielded balance.
        </p>
        <HowThisWorks className="mt-2">
          <p>
            The address you pay and the amount are visible onchain, the same as any card
            settlement. What stays hidden is which of your notes paid it and what you have left.
          </p>
        </HowThisWorks>
      </div>

      {!myWalletAccount && (
        <VerbEvidence
          stamp="sepolia"
          title="A swipe has already settled from a shielded balance"
          verdict="One transaction sells shielded STRK, pays the merchant in USDC and records the authorization. The receipts below are those swipes, read back against Sepolia. Every card contract in this product is deployed on Sepolia only, so none of this has run on mainnet and none of it moved real money."
          receiptsLabel="What has settled: card authorizations against the pool"
          receipts={SWIPE_RECEIPTS}
          footnote="These settled through a hosted account that holds its own server side viewing key, so Sealed's operator can see them. That is why this surface is marked partial rather than live, and the form below submits from your own wallet instead, which the operator cannot read."
        />
      )}

      {/* The live contract read goes above the form. A disabled form is the
          least informative thing on this page; a fee and a block number the
          reader can check are the most. */}
      <PoolFacts network={network} snapshot={pool} />

      <div className={ui.inputBlock}>
        <label htmlFor="spend-recipient" className={ui.inputLabel}>
          Amount to pay
        </label>
        <div className="mt-3 flex flex-col gap-2.5">
          <input
            id="spend-recipient"
            className={ui.inputField}
            aria-label="Acquirer or merchant address"
            placeholder="Acquirer or merchant address (0x…)"
            value={legs[0].recipient}
            onChange={(e) => updateLeg({ recipient: e.target.value })}
          />
          <input
            className={ui.inputField}
            aria-label="Purchase amount"
            placeholder="Purchase amount"
            inputMode="decimal"
            value={legs[0].amount}
            onChange={(e) => updateLeg({ amount: e.target.value })}
          />
        </div>
        <div className={`${ui.subLine} mt-3`}>
          <button
            type="button"
            className={ui.tab}
            onClick={useMax}
            disabled={maxLoading || !myWalletAccount}
          >
            {maxLoading ? "reading shielded balance…" : "Use max"}
          </button>
        </div>
      </div>

      <div>
        <FeeRow fee={fee} error={pool.error} />
        <p className={`${ui.note} mt-2`}>
          Ready shows the settlement amount and STRK pool fee before you approve.
        </p>
      </div>

      {address !== "" && !strk20Capable && (
        <div className={ui.warn}>This wallet doesn&apos;t support private balances yet. Install or update Ready to continue.</div>
      )}
      {maturity.locked && (
        <div className={ui.warn}>
          {maturity.blocksRemaining === undefined
            ? `Notes from your last STRK shield mature about 10 blocks after the deposit.`
            : `Notes from your last STRK shield are still maturing: ~${maturity.blocksRemaining} block${
                maturity.blocksRemaining === 1 ? "" : "s"
              } left before they can be spent.`}
        </div>
      )}

      <button
        type="button"
        className={ui.btnCta}
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
