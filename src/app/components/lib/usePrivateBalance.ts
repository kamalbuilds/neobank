"use client";
import { useEffect, useState } from "react";
import { TOKENS, providerFor, type TokenSymbol } from "@/utils/constants";
import { useStoreWallet } from "../Wallet/walletContext";
import { readPrivateBalances } from "./strk20";

// Explicit user consent to reveal shielded balances (a button click), never a
// background probe. Reads both tokens in one wallet prompt.
export function useShieldedBalances() {
  const myWalletAccount = useStoreWallet((s) => s.myWalletAccount);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [balances, setBalances] = useState<Partial<Record<TokenSymbol, bigint>>>({});

  async function reveal() {
    if (!myWalletAccount) return;
    setLoading(true);
    setError(undefined);
    try {
      const entries = await readPrivateBalances(myWalletAccount, [TOKENS.STRK.address, TOKENS.USDC.address]);
      setBalances({ STRK: entries[0].balance, USDC: entries[1].balance });
      setRevealed(true);
    } catch (err: any) {
      setError(err?.message ?? "Could not read your shielded balances.");
    } finally {
      setLoading(false);
    }
  }

  function hide() {
    setRevealed(false);
    setBalances({});
    setError(undefined);
  }

  return { revealed, loading, error, balances, reveal, hide };
}

const POLL_INTERVAL_MS = 15_000;

// Live block countdown to a token's note-maturity block, set from a real
// receipt after a confirmed shield. Never fakes progress when the chain
// cannot be reached - currentBlock just stays whatever it last was.
export function useMaturity(token: TokenSymbol) {
  const network = useStoreWallet((s) => s.network);
  const matureAtBlock = useStoreWallet((s) => s.maturity[token]);
  const clearMaturity = useStoreWallet((s) => s.clearMaturity);
  const [currentBlock, setCurrentBlock] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!network || matureAtBlock === undefined) {
      setCurrentBlock(undefined);
      return;
    }
    let cancelled = false;
    const provider = providerFor(network);
    async function poll() {
      try {
        const block = await provider.getBlockNumber();
        if (!cancelled) setCurrentBlock(block);
      } catch {
        // Leave currentBlock as-is - an RPC hiccup must not fake progress.
      }
    }
    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [network, matureAtBlock]);

  useEffect(() => {
    if (matureAtBlock !== undefined && currentBlock !== undefined && currentBlock >= matureAtBlock) {
      clearMaturity(token);
    }
  }, [matureAtBlock, currentBlock, token, clearMaturity]);

  if (matureAtBlock === undefined) {
    return { locked: false as const, blocksRemaining: undefined, matureAtBlock: undefined };
  }
  const blocksRemaining = currentBlock === undefined ? undefined : Math.max(0, matureAtBlock - currentBlock);
  return { locked: blocksRemaining !== 0, blocksRemaining, matureAtBlock };
}
