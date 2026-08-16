"use client";
import { useEffect, useState } from "react";
import { getQuotes, type Quote } from "@avnu/avnu-sdk";
import styles from "../../uni.module.css";
import { useStoreWallet } from "../Wallet/walletContext";
import { TOKENS, getPublicBalance, type NetworkKey, type TokenSymbol } from "@/utils/constants";
import { fromBaseUnits, toBaseUnits } from "../lib/format";
import { waitStrk20Transaction } from "../lib/strk20";
import { avnuConfigured, clientAvnuOptions, fetchPrivateSwapFee, proveAndSubmitPrivateSwap } from "../lib/avnu";
import { useMaturity, useShieldedBalances } from "../lib/usePrivateBalance";
import TokenSelect from "./TokenSelect";
import FeeRow from "./FeeRow";
import { ResultCard, errorResult, receiptToResult, type ActionResult } from "./ActionResult";

const SLIPPAGE = 0.05;

// The SDK's own executePrivateSwap fails fast on a chain mismatch before the
// expensive proof. The split flow (server-side fee/submit, client-side proving)
// drops that guard, so re-apply it here. Only enforced when both ids parse as
// felts - an unparseable id must not block a valid swap.
function chainMismatch(walletChainId: string, quoteChainId: string): boolean {
  try {
    return BigInt(walletChainId) !== BigInt(quoteChainId);
  } catch {
    return false;
  }
}

export default function SwapPanel({ network }: { network: NetworkKey }) {
  const myWalletAccount = useStoreWallet((s) => s.myWalletAccount);
  const address = useStoreWallet((s) => s.address);
  const chainId = useStoreWallet((s) => s.chain);
  const strk20Capable = useStoreWallet((s) => s.strk20Capable);

  const [sellToken, setSellToken] = useState<TokenSymbol>("STRK");
  const [buyToken, setBuyToken] = useState<TokenSymbol>("USDC");
  const [amount, setAmount] = useState("");
  const [configured, setConfigured] = useState<boolean | undefined>(undefined);
  const [quoting, setQuoting] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [feeAmount, setFeeAmount] = useState<bigint | undefined>(undefined);

  const maturity = useMaturity(sellToken);
  const shielded = useShieldedBalances();

  useEffect(() => {
    let cancelled = false;
    avnuConfigured()
      .then((ok) => {
        if (!cancelled) setConfigured(ok);
      })
      .catch(() => {
        if (!cancelled) setConfigured(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function flipTokens(nextSell: TokenSymbol) {
    setSellToken(nextSell);
    setBuyToken(nextSell === "STRK" ? "USDC" : "STRK");
    setQuote(null);
  }

  async function handleQuote() {
    setResult(null);
    setQuote(null);
    let units: bigint;
    try {
      units = toBaseUnits(amount, TOKENS[sellToken].decimals);
    } catch (err: any) {
      setResult(errorResult(err.message));
      return;
    }
    setQuoting(true);
    try {
      // No takerAddress on the quote request. It is optional here, and
      // `quoteToCalls({private: true})` sets the taker to AVNU's executor
      // anyway - sending the user's public address would hand AVNU the
      // quoteId -> address link that the pool exists to hide, before the same
      // quoteId is submitted through their paymaster.
      const quotes = await getQuotes(
        {
          sellTokenAddress: TOKENS[sellToken].address,
          buyTokenAddress: TOKENS[buyToken].address,
          sellAmount: units,
          size: 1,
        },
        clientAvnuOptions(network)
      );
      if (!quotes[0]) throw new Error("AVNU returned no quote for this pair and amount.");
      setQuote(quotes[0]);
    } catch (err: any) {
      setResult(errorResult(err?.message ?? "Could not fetch an AVNU quote."));
    } finally {
      setQuoting(false);
    }
  }

  async function handleSwap() {
    setResult(null);
    if (!myWalletAccount || !address) {
      setResult(errorResult("Connect a wallet first."));
      return;
    }
    if (!quote) {
      setResult(errorResult("Fetch a quote first."));
      return;
    }
    if (chainId && chainMismatch(chainId, quote.chainId)) {
      setResult(errorResult("This quote is for a different network than the connected wallet. Fetch a new quote."));
      return;
    }
    setSubmitting(true);
    try {
      const { fee, feeMode } = await fetchPrivateSwapFee(network, TOKENS.STRK.address);
      setFeeAmount(fee.amount);
      const publicStrk = await getPublicBalance(network, TOKENS.STRK.address, address);
      if (publicStrk < fee.amount) {
        setResult(errorResult(
          `Need at least ${fromBaseUnits(fee.amount, TOKENS.STRK.decimals)} public STRK for the pool fee. This wallet has ${fromBaseUnits(publicStrk, TOKENS.STRK.decimals)} public STRK. Ready will refuse the swap until you top up.`,
        ));
        setSubmitting(false);
        return;
      }
      const txHash = await proveAndSubmitPrivateSwap({
        network,
        walletAccount: myWalletAccount,
        quote,
        slippage: SLIPPAGE,
        takerAddress: address,
        fee,
        feeMode,
      });
      const amountLabel = `${fromBaseUnits(quote.sellAmount, TOKENS[sellToken].decimals)} ${sellToken} -> ${fromBaseUnits(quote.buyAmount, TOKENS[buyToken].decimals)} ${buyToken} (private)`;
      setResult({
        status: "pending",
        title: "Waiting for confirmation…",
        rows: [{ label: "Swap", value: amountLabel }, { label: "Transaction", value: txHash, hash: txHash }],
      });
      const outcome = await waitStrk20Transaction(txHash, network);
      if (outcome.status === "confirmed") {
        setResult(receiptToResult(outcome.receipt, txHash, amountLabel));
      } else if (outcome.status === "submitted") {
        setResult({
          status: "pending",
          title: "Submitted - not yet confirmed by this RPC",
          note: "Paymaster-relayed private swaps can take a while to surface. Track it on the explorer.",
          rows: [{ label: "Transaction", value: txHash, hash: txHash }],
        });
      } else {
        setResult(errorResult(outcome.message));
      }
    } catch (err: any) {
      setResult(errorResult(err?.message ?? "Private swap failed."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.warn} style={{ color: "var(--muted)" }}>
        The sell token must already be shielded. This swap cannot deposit for you.
        The bought token lands back as a private note. Open-note fill amounts can stay public.
      </div>

      {configured === false && (
        <div className={styles.warn}>
          AVNU private swap is not configured on this server. Set `AVNU_PAYMASTER_API_KEY` in the server env; this app never puts the key in the browser.
        </div>
      )}

      <div className={styles.inputBlock}>
        <div className={styles.inputLabel}>You&apos;re selling privately</div>
        <div className={styles.inputMain}>
          <input
            className={styles.bigValue}
            style={{ border: "none", outline: "none", background: "transparent", width: "60%" }}
            placeholder="0"
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setQuote(null);
            }}
          />
          <TokenSelect value={sellToken} onChange={flipTokens} />
        </div>
        <div className={styles.subLine}>
          <span>Buying {buyToken} · 5% slippage</span>
        </div>
      </div>

      <div className={styles.subLine}>
        <button className={styles.tab} onClick={shielded.revealed ? shielded.hide : shielded.reveal} disabled={shielded.loading || !myWalletAccount}>
          {shielded.loading ? "reading shielded balances…" : shielded.revealed ? "Hide shielded balances" : "Show shielded STRK/USDC"}
        </button>
      </div>
      {shielded.error ? <div className={styles.warn}>{shielded.error}</div> : null}
      {shielded.revealed && (
        <div className={styles.subLine}>
          <span className={styles.subMono}>
            {shielded.balances[sellToken] !== undefined
              ? `${fromBaseUnits(shielded.balances[sellToken]!, TOKENS[sellToken].decimals)} ${sellToken} shielded`
              : "…"}
          </span>
        </div>
      )}

      {maturity.locked && (
        <div className={styles.warn}>
          {maturity.blocksRemaining === undefined
            ? `Notes from your last ${sellToken} shield mature about 10 blocks after the deposit.`
            : `Notes from your last ${sellToken} shield are still maturing: ~${maturity.blocksRemaining} block${
                maturity.blocksRemaining === 1 ? "" : "s"
              } left before they can be spent.`}
        </div>
      )}

      {feeAmount === undefined ? (
        <div className={styles.feeRow}>
          <span>Pool fee (per private operation)</span>
          <span className={styles.feeVal}>quoted by the paymaster at submit</span>
        </div>
      ) : (
        <FeeRow fee={feeAmount} />
      )}

      {quote ? (
        <div className={styles.feeRow}>
          <span>Quoted buy amount</span>
          <span className={styles.feeVal}>
            {fromBaseUnits(quote.buyAmount, TOKENS[buyToken].decimals)} {buyToken}
          </span>
        </div>
      ) : null}

      {!strk20Capable && (
        <div className={styles.warn}>This wallet does not support STRK20 privacy actions. Install or update Ready.</div>
      )}

      <button
        className={styles.btnCta}
        disabled={!strk20Capable || quoting || !amount || configured === false || maturity.locked}
        onClick={handleQuote}
      >
        {quoting ? "Quoting…" : configured === false ? "AVNU not configured" : maturity.locked ? "Notes maturing…" : "Get quote"}
      </button>
      <button
        className={styles.btnCta}
        disabled={!strk20Capable || submitting || !quote || configured === false || maturity.locked}
        onClick={handleSwap}
      >
        {submitting ? "Swapping privately…" : "Swap privately"}
      </button>

      {result ? <ResultCard r={result} network={network} /> : null}
    </div>
  );
}
