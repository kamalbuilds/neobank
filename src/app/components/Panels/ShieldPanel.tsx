"use client";
import { useState } from "react";
import { ui } from "../lib/panelUi";
import { useStoreWallet } from "../Wallet/walletContext";
import { TOKENS, getPublicBalance, type TokenSymbol, type NetworkKey } from "@/utils/constants";
import { toBaseUnits, fromBaseUnits } from "../lib/format";
import { submitConnectedShield, waitStrk20Transaction, isScreeningRevert } from "../lib/strk20";
import { usePoolFee } from "../lib/useFee";
import TokenSelect from "./TokenSelect";
import FeeRow from "./FeeRow";
import { ResultCard, errorResult, receiptToResult, walletErrorResult, type ActionResult } from "./ActionResult";
import { HowThisWorks } from "../v2/ui";

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
      title: "Shielding…",
      note: "First time shielding, your wallet approves two prompts: one to activate the account, one for the deposit.",
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
    <div className={ui.panel}>
      <div className="px-3 pt-2">
        <p className="text-[13px] leading-relaxed text-[#7a859c]">
          Moving money into your shielded balance. The deposit is public; what it becomes is
          readable only with your viewing key.
        </p>
        <HowThisWorks className="mt-2">
          <p>
            The deposit itself is a public onchain transaction, like any transfer. What stays
            private is your balance and who you move it to afterward. If this is your first time
            shielding with this wallet, it needs one extra approval first to activate your account
            for private actions.
          </p>
          <p className="mt-2">
            New deposits take about 10 blocks (roughly a minute) before they can be spent or sent.
          </p>
        </HowThisWorks>
      </div>

      <div className={ui.inputBlock}>
        <div className={ui.inputLabel}>Amount to shield</div>
        <div className={ui.inputMain}>
          <input
            className={ui.bigValue}
            placeholder="0"
            inputMode="decimal"
            aria-label="Amount to shield"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <TokenSelect value={token} onChange={setToken} />
        </div>
        <div className={ui.subLine}>
          <button
            type="button"
            className="text-[13px] font-medium text-[#7a859c] transition-colors hover:text-[#eaf0f8] disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={useMax}
            disabled={maxLoading || !address}
          >
            {maxLoading ? "reading balance…" : "Use max (public balance minus fee)"}
          </button>
        </div>
      </div>

      <FeeRow fee={fee} />
      <div className={ui.subLine} style={{ color: "var(--muted)" }}>
        The fee is separate public STRK from your wallet, not taken out of this deposit.
      </div>

      {token === "USDC" && (
        <div className={ui.warn} style={{ color: "var(--muted)" }}>
          Some wallets also set aside a small extra amount when shielding USDC, on top of the pool
          fee above. That is wallet behavior, not a charge from this app, and the amount is not
          fixed - your wallet will show it before you approve.
        </div>
      )}

      {!strk20Capable && (
        <div className={ui.warn}>This wallet doesn&apos;t support private balances yet. Install or update Ready to continue.</div>
      )}

      <button
        type="button"
        className={ui.btnCta}
        disabled={!strk20Capable || submitting || !amount}
        onClick={handleShield}
      >
        {submitting ? "Shielding…" : "Shield"}
      </button>

      {result ? <ResultCard r={result} network={network} /> : null}
    </div>
  );
}
