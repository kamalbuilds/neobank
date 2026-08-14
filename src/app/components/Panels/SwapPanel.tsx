"use client";
import { useEffect, useState } from "react";
import { getQuotes, type Quote } from "@avnu/avnu-sdk";
import styles from "../../uni.module.css";
import { useStoreWallet } from "../Wallet/walletContext";
import { TOKENS, type NetworkKey, type TokenSymbol } from "@/utils/constants";
import { fromBaseUnits, toBaseUnits } from "../lib/format";
import { waitStrk20Transaction } from "../lib/strk20";
import { avnuConfigured, clientAvnuOptions, fetchPrivateSwapFee, proveAndSubmitPrivateSwap } from "../lib/avnu";
import TokenSelect from "./TokenSelect";
import FeeRow from "./FeeRow";
import { ResultCard, errorResult, receiptToResult, type ActionResult } from "./ActionResult";

const SLIPPAGE = 0.05;

export default function SwapPanel({ network }: { network: NetworkKey }) {
  const myWalletAccount = useStoreWallet((s) => s.myWalletAccount);
  const address = useStoreWallet((s) => s.address);
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
      const quotes = await getQuotes(
        {
          sellTokenAddress: TOKENS[sellToken].address,
          buyTokenAddress: TOKENS[buyToken].address,
          sellAmount: units,
          takerAddress: address || undefined,
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
    setSubmitting(true);
    try {
      const { fee, feeMode } = await fetchPrivateSwapFee(network, TOKENS.STRK.address);
      setFeeAmount(fee.amount);
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
        const receipt = { execution_status: outcome.reverted ? "REVERTED" : "SUCCEEDED" };
        setResult(receiptToResult(receipt, txHash, amountLabel));
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
          AVNU private swap is not configured on this server. Add `AVNU_PAYMASTER_API_KEY` to `.env` (server-side only, from the AVNU portal) and restart.
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

      <FeeRow fee={feeAmount} />

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
        disabled={!strk20Capable || quoting || !amount}
        onClick={handleQuote}
      >
        {quoting ? "Quoting…" : "Get quote"}
      </button>
      <button
        className={styles.btnCta}
        disabled={!strk20Capable || submitting || !quote || configured === false}
        onClick={handleSwap}
      >
        {submitting ? "Swapping privately…" : "Swap privately"}
      </button>

      {result ? <ResultCard r={result} network={network} /> : null}
    </div>
  );
}
