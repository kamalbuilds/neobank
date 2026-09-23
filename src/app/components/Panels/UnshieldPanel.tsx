"use client";
import { useEffect, useState } from "react";
import { validateAndParseAddress } from "starknet";
import { ui } from "../lib/panelUi";
import { cx } from "../v2/ui";
import { useStoreWallet } from "../Wallet/walletContext";
import { TOKENS, getPublicBalance, type TokenSymbol, type NetworkKey } from "@/utils/constants";
import { toBaseUnits, fromBaseUnits } from "../lib/format";
import { submitStrk20, waitStrk20Transaction, readPrivateBalance } from "../lib/strk20";
import { useMaturity, useShieldedBalances } from "../lib/usePrivateBalance";
import TokenSelect from "./TokenSelect";
import FeeRow from "./FeeRow";
import { ResultCard, errorResult, receiptToResult, walletErrorResult, type ActionResult } from "./ActionResult";
import { Figure, HowThisWorks, PanelState } from "../v2/ui";
import PoolFacts, { usePoolSnapshot } from "./PoolFacts";

export default function UnshieldPanel({ network }: { network: NetworkKey }) {
  const myWalletAccount = useStoreWallet((s) => s.myWalletAccount);
  const address = useStoreWallet((s) => s.address);
  const strk20Capable = useStoreWallet((s) => s.strk20Capable);

  const [token, setToken] = useState<TokenSymbol>("STRK");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [maxLoading, setMaxLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  const pool = usePoolSnapshot(network);
  const fee = pool.fee;
  const tokenConfig = TOKENS[token];
  const maturity = useMaturity(token);
  const shielded = useShieldedBalances();

  const [publicStrk, setPublicStrk] = useState<bigint | undefined>(undefined);
  const [publicStrkError, setPublicStrkError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!address) {
      setPublicStrk(undefined);
      setPublicStrkError(undefined);
      return;
    }
    let cancelled = false;
    setPublicStrkError(undefined);
    getPublicBalance(network, TOKENS.STRK.address, address)
      .then((balance) => {
        if (!cancelled) setPublicStrk(balance);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setPublicStrk(undefined);
        // A failed read is not a zero balance. Saying so is what stops the
        // shortfall warning below from firing on an RPC hiccup.
        setPublicStrkError(err?.message ?? "Could not read your public STRK balance.");
      });
    return () => {
      cancelled = true;
    };
  }, [address, network, fee]);

  const feeShortfall = address !== undefined && fee !== undefined && publicStrk !== undefined && publicStrk < fee;

  async function useMax() {
    if (!myWalletAccount) return;
    setMaxLoading(true);
    try {
      const balance = await readPrivateBalance(myWalletAccount, tokenConfig.address);
      // Pool fee is public STRK from tx.caller, not taken out of the note.
      setAmount(fromBaseUnits(balance, tokenConfig.decimals));
    } catch (err: any) {
      setResult(errorResult(err?.message ?? "Could not read your shielded balance."));
    } finally {
      setMaxLoading(false);
    }
  }

  async function handleUnshield() {
    setResult(null);
    if (!myWalletAccount) {
      setResult(errorResult("Connect a wallet first."));
      return;
    }
    const destRaw = recipient.trim() || address;
    let dest: string;
    try {
      dest = validateAndParseAddress(destRaw);
    } catch {
      setResult(errorResult("Enter a valid public recipient address."));
      return;
    }
    let units: bigint;
    try {
      units = toBaseUnits(amount, tokenConfig.decimals);
    } catch (err: any) {
      setResult(errorResult(err.message));
      return;
    }
    if (address && fee !== undefined) {
      try {
        const publicStrk = await getPublicBalance(network, TOKENS.STRK.address, address);
        if (publicStrk < fee) {
          setResult(errorResult(
            `Need at least ${fromBaseUnits(fee, TOKENS.STRK.decimals)} public STRK for the pool fee. This wallet has ${fromBaseUnits(publicStrk, TOKENS.STRK.decimals)} public STRK. Ready will refuse the unshield until you top up.`,
          ));
          return;
        }
      } catch (err: any) {
        setResult(errorResult(err?.message ?? "Could not read public STRK before unshield."));
        return;
      }
    }
    setSubmitting(true);
    const submission = await submitStrk20(myWalletAccount, [
      { type: "withdraw", token: tokenConfig.address, amount: `0x${units.toString(16)}`, recipient: dest },
    ]);
    if (!submission.ok || !submission.txHash) {
      setResult(walletErrorResult(submission.error));
      setSubmitting(false);
      return;
    }
    const amountLabel = `${amount} ${token} (public withdrawal)`;
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
    <div className={ui.panel}>
      <div>
        <h2 className={ui.heading}>Withdraw to a public address</h2>
        <p className={`${ui.note} mt-1.5`}>
          Move funds out of your shielded balance to a public wallet. Leave the destination blank
          to withdraw back to this wallet.
        </p>
        <HowThisWorks className="mt-2">
          <p>The withdrawal amount and destination address become visible onchain once it lands.</p>
        </HowThisWorks>
      </div>

      <div className={ui.inputBlock}>
        <label htmlFor="unshield-amount" className={ui.inputLabel}>
          Amount to withdraw
        </label>
        <div className={ui.inputMain}>
          <input
            id="unshield-amount"
            className={ui.bigValue}
            placeholder="0"
            inputMode="decimal"
            aria-label={`Amount of ${token} to unshield`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <TokenSelect value={token} onChange={setToken} />
        </div>
        <input
          className={cx(ui.inputField, "mt-2")}
          aria-label="Public destination address"
          placeholder="Public destination (blank = this wallet)"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
        />
        <div className={cx(ui.subLine, "mt-3")}>
          <button type="button" className={ui.tab} onClick={useMax} disabled={maxLoading || !myWalletAccount}>
            {maxLoading ? "reading shielded balance…" : "Use max"}
          </button>
        </div>
      </div>

      <div>
        <FeeRow fee={fee} error={pool.error} />
        {address && fee !== undefined && (
          <p className={`${ui.note} mt-2`}>
            <Figure className="text-ink">
              public STRK:{" "}
              {publicStrkError
                ? "read failed"
                : publicStrk !== undefined
                ? fromBaseUnits(publicStrk, TOKENS.STRK.decimals)
                : "…"}{" "}
              / fee: {fromBaseUnits(fee, TOKENS.STRK.decimals)}
            </Figure>
          </p>
        )}
        {publicStrkError ? (
          <PanelState kind="error" title="Could not read your public STRK" className="mt-2">
            {publicStrkError} The shortfall check below is skipped rather than guessed, so Ready
            stays the authority on whether the fee is covered.
          </PanelState>
        ) : null}
        {feeShortfall && (
          <div className={`${ui.warn} mt-2`}>
            Need at least {fromBaseUnits(fee!, TOKENS.STRK.decimals)} public STRK for the pool fee. This wallet has{" "}
            {fromBaseUnits(publicStrk!, TOKENS.STRK.decimals)} public STRK. Ready will refuse the unshield until you top up.
          </div>
        )}
        <p className={`${ui.note} mt-2`}>
          Ready may require a buffer above the live pool fee shown here. The fee itself is still public STRK, not taken from this note.
        </p>
      </div>

      <div>
        <div className={ui.subLine}>
          <button
            type="button"
            className={ui.tab}
            onClick={shielded.revealed ? shielded.hide : shielded.reveal}
            disabled={shielded.loading || !myWalletAccount}
          >
            {shielded.loading
              ? "reading shielded balances…"
              : shielded.revealed
              ? "Hide shielded balances"
              : "Show shielded STRK/USDC"}
          </button>
        </div>
        {shielded.loading ? (
          <PanelState
            kind="loading"
            rows={1}
            title="Scanning your notes for a shielded balance"
            className="mt-2"
          />
        ) : shielded.error ? (
          <PanelState kind="error" title="Could not read your shielded balances" className="mt-2">
            {shielded.error} Nothing is shown from a cache, so try the button again once Ready is
            responding.
          </PanelState>
        ) : shielded.revealed ? (
          <div className={cx(ui.subLine, "mt-2 justify-start gap-6")}>
            <Figure className="text-ink">
              {shielded.balances.STRK !== undefined
                ? fromBaseUnits(shielded.balances.STRK, TOKENS.STRK.decimals)
                : "…"}{" "}
              STRK
            </Figure>
            <Figure className="text-ink">
              {shielded.balances.USDC !== undefined
                ? fromBaseUnits(shielded.balances.USDC, TOKENS.USDC.decimals)
                : "…"}{" "}
              USDC
            </Figure>
          </div>
        ) : null}
      </div>

      {maturity.locked && (
        <div className={ui.warn}>
          {maturity.blocksRemaining === undefined
            ? `Notes from your last ${token} shield mature about 10 blocks after the deposit.`
            : `Notes from your last ${token} shield are still maturing: ~${maturity.blocksRemaining} block${
                maturity.blocksRemaining === 1 ? "" : "s"
              } left before they can be spent.`}
        </div>
      )}

      {!strk20Capable && (
        <div className={ui.warn}>This wallet doesn&apos;t support private balances yet. Install or update Ready to continue.</div>
      )}

      <button
        type="button"
        className={ui.btnCta}
        disabled={!strk20Capable || submitting || !amount || maturity.locked || feeShortfall}
        onClick={handleUnshield}
      >
        {submitting ? "Withdrawing…" : maturity.locked ? "Notes maturing…" : "Withdraw"}
      </button>

      {result ? <ResultCard r={result} network={network} /> : null}

      {/* Reads with no wallet connected, so this panel is never an empty shell. */}
      <PoolFacts network={network} snapshot={pool} />
    </div>
  );
}
