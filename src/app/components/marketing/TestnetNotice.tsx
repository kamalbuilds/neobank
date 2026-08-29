/**
 * The one thing every prior pass got wrong: a network badge styled like a
 * product name. This is not decoration - it is the honesty disclosure that
 * every transaction on this build moves test money, not real funds. Used on
 * the landing page and inside the account chrome, so it is never more than
 * one screen away.
 */
export function TestnetNotice({ className = '' }: { className?: string }) {
  return (
    <div
      role="note"
      className={`flex items-center justify-center gap-2 border-b border-[#f59e0b]/20 bg-[#f59e0b]/[0.06] px-4 py-2 text-center text-[12.5px] font-medium text-[#fbbf78] ${className}`}
    >
      <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#f59e0b]" aria-hidden="true" />
      Sepolia testnet &middot; real transactions, test money. Nothing here moves mainnet funds.
    </div>
  );
}
