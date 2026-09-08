'use client';

import { useStoreWallet } from '../Wallet/walletContext';
import type { NetworkKey } from '@/utils/constants';

/**
 * The one thing every prior pass got wrong: a network badge styled like a
 * product name. This is not decoration - it is the honesty disclosure that a
 * transaction on this build moves test money, not real funds.
 *
 * Which makes it wrong to show on a mainnet wallet, where the opposite is
 * true: the STRK20 pool at 0x040337b1…812a is the live one and a shield there
 * spends real STRK. So the notice reads the connected wallet's chain and
 * disappears on mainnet rather than telling a mainnet user their funds are
 * fake. Pre-connect it stays up, because DEFAULT_NETWORK is sepolia and that
 * is genuinely where an unconnected session would act.
 */
/**
 * Null means show nothing. Split out from the component so the mainnet case is
 * testable in a node environment: this repo has no DOM test runner, and the
 * rule that matters is which string a network gets, not how it is styled.
 */
export function testnetNoticeCopy(network: NetworkKey | undefined): string | null {
  if (network === 'mainnet') return null;
  return network === 'sepolia'
    ? 'Sepolia testnet · real transactions, test money. This wallet is not on the live pool.'
    : 'Sepolia testnet by default · connect a wallet on mainnet to use the live STRK20 pool.';
}

export function TestnetNotice({ className = '' }: { className?: string }) {
  const network = useStoreWallet((s) => s.network);
  const copy = testnetNoticeCopy(network);
  if (copy === null) return null;

  return (
    <div
      role="note"
      className={`flex items-center justify-center gap-2 border-b border-[#f59e0b]/20 bg-[#f59e0b]/[0.06] px-4 py-2 text-center text-[12.5px] font-medium text-[#fbbf78] ${className}`}
    >
      <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#f59e0b]" aria-hidden="true" />
      {copy}
    </div>
  );
}
