"use client";
import { useEffect, useState } from "react";
import { getQuotes, type Quote } from "@avnu/avnu-sdk";
import { ui } from "../lib/panelUi";
import { useStoreWallet } from "../Wallet/walletContext";
import { TOKENS, getPublicBalance, type NetworkKey, type TokenSymbol } from "@/utils/constants";
import { fromBaseUnits, toBaseUnits } from "../lib/format";
import { waitStrk20Transaction } from "../lib/strk20";
import { avnuConfigured, clientAvnuOptions, fetchPrivateSwapFee, proveAndSubmitPrivateSwap } from "../lib/avnu";
import { useMaturity, useShieldedBalances } from "../lib/usePrivateBalance";
import TokenSelect from "./TokenSelect";
import FeeRow from "./FeeRow";
import { ResultCard, errorResult, receiptToResult, type ActionResult } from "./ActionResult";
import { Figure, HowThisWorks, PanelState } from "../v2/ui";
import PoolFacts, { usePoolSnapshot } from "./PoolFacts";

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
  const pool = usePoolSnapshot(network);

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
    <div className={ui.panel}>
      <div>
        <h2 className={ui.heading}>Convert inside the pool</h2>
        <p className={`${ui.note} mt-1.5`}>
          Convert between STRK and USDC without leaving your shielded balance. The token you sell
          needs to already be shielded first.
        </p>
        <HowThisWorks className="mt-2">
          <p>
            The converted token comes back as a private note. The fill price can be visible to the
            router that executes it, the same as any onchain swap.
          </p>
        </HowThisWorks>
      </div>

      {configured === undefined ? (
        <PanelState kind="loading" rows={1} title="Checking whether the AVNU router is reachable" />
      ) : null}
      {/* The unconfigured case is rendered once, by the route, which can name the
          missing variable. Repeating it here said "temporarily unavailable, try
          again shortly" over the top of it, which is both a duplicate and a
          softer claim than the truth: no key is set and retrying changes nothing. */}

      <div className={ui.inputBlock}>
        <label htmlFor="convert-amount" className={ui.inputLabel}>
          Amount to convert
        </label>
        <div className={ui.inputMain}>
          <input
            id="convert-amount"
            className={ui.bigValue}
            placeholder="0"
            inputMode="decimal"
            aria-label={`Amount of ${sellToken} to sell`}
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setQuote(null);
            }}
          />
          <TokenSelect value={sellToken} onChange={flipTokens} />
        </div>
        <div className={ui.subLine}>
          <span>
            Buying {buyToken} · <Figure>5%</Figure> slippage
          </span>
        </div>
      </div>

      <div>
        <div className={ui.subLine}>
          <button
            type="button"
            className={ui.tab}
            onClick={shielded.revealed ? shielded.hide : shielded.reveal}
            disabled={shielded.loading || !myWalletAccount}
          >
            {shielded.loading ? "reading shielded balances…" : shielded.revealed ? "Hide shielded balances" : "Show shielded STRK/USDC"}
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
          <p className={`${ui.note} mt-2`}>
            <Figure className="text-ink">
              {shielded.balances[sellToken] !== undefined
                ? `${fromBaseUnits(shielded.balances[sellToken]!, TOKENS[sellToken].decimals)} ${sellToken} shielded`
                : "…"}
            </Figure>
          </p>
        ) : null}
      </div>

      {maturity.locked && (
        <div className={ui.warn}>
          {maturity.blocksRemaining === undefined
            ? `Notes from your last ${sellToken} shield mature about 10 blocks after the deposit.`
            : `Notes from your last ${sellToken} shield are still maturing: ~${maturity.blocksRemaining} block${
                maturity.blocksRemaining === 1 ? "" : "s"
              } left before they can be spent.`}
        </div>
      )}

      <div>
        {feeAmount === undefined ? (
          <div className={ui.feeRow}>
            <div className="min-w-0">
              <span>Swap fee</span>
              <div className="mt-1 text-[11px] leading-snug text-muted">
                quoted by the paymaster at submit time, not before
              </div>
            </div>
            <span className={ui.feeVal}>shown when you submit</span>
          </div>
        ) : (
          <FeeRow fee={feeAmount} />
        )}

        {quoting ? (
          <PanelState kind="loading" rows={1} title="Asking AVNU for a quote" className="mt-3" />
        ) : quote ? (
          <div className={ui.feeRow}>
            <span>Quoted buy amount</span>
            <span className={ui.feeVal}>
              {fromBaseUnits(quote.buyAmount, TOKENS[buyToken].decimals)} {buyToken}
            </span>
          </div>
        ) : (
          <PanelState kind="empty" title="No quote yet" className="mt-3">
            Enter an amount and press Get quote. AVNU prices the fill before anything is signed,
            and the quote is what the Convert button then executes.
          </PanelState>
        )}
      </div>

      {address !== "" && !strk20Capable && (
        <div className={ui.warn}>This wallet doesn&apos;t support private balances yet. Install or update Ready to continue.</div>
      )}

      {configured !== false && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className={ui.tab + " w-full py-3 text-[15px]"}
            disabled={!strk20Capable || quoting || !amount || maturity.locked}
            onClick={handleQuote}
          >
            {quoting ? "Quoting…" : maturity.locked ? "Notes maturing…" : "Get quote"}
          </button>
          <button
            type="button"
            className={ui.btnCta}
            disabled={!strk20Capable || submitting || !quote || maturity.locked}
            onClick={handleSwap}
          >
            {submitting ? "Converting…" : "Convert"}
          </button>
        </div>
      )}

      {result ? <ResultCard r={result} network={network} /> : null}

      {/* Reads with no wallet connected, so this panel is never an empty shell. */}
      <PoolFacts network={network} snapshot={pool} />
    </div>
  );
}
