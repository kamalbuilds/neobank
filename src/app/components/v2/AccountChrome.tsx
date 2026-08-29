'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStoreWallet } from '../Wallet/walletContext';
import SelectWallet from '../client/WalletHandle/SelectWallet';
import { readPrivateBalance } from '../lib/strk20';
import { getPublicBalance, TOKENS, type NetworkKey } from '@/utils/constants';
import { fromBaseUnits } from '../lib/format';
import { PRIMARY_ROUTES, ROUTE_GROUPS, primaryForPath } from './accountRoutes';
import { NumberTicker, RouteTransition, Skeleton } from './ui';

const TAB_BTN =
  'px-4 py-2.5 rounded-xl text-[14px] font-semibold whitespace-nowrap transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2dd4bf]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06070b]';
const TAB_ON =
  'text-[#04140f] bg-gradient-to-br from-[#2dd4bf] to-[#38bdf8] shadow-[0_4px_16px_-6px_rgba(45,212,191,0.5)]';
const TAB_OFF = 'text-[#a3acbd] hover:text-[#eaf0f8] hover:bg-white/[0.04]';

const SUBTAB_BTN =
  'px-3 py-1.5 rounded-lg text-[12.5px] font-medium whitespace-nowrap transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2dd4bf]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06070b]';
const SUBTAB_ON = 'text-[#eaf0f8] bg-white/[0.08]';
const SUBTAB_OFF = 'text-[#7a859c] hover:text-[#eaf0f8] hover:bg-white/[0.04]';

function navActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Pre-connect, a tab still previews what it does: the panel renders and only
 * its submit controls are gated. Hiding the whole panel left Spend and Send
 * with no copy at all until a wallet linked.
 */
export function AccountConnectWall({ children }: { children: ReactNode }) {
  const myWalletAccount = useStoreWallet((s) => s.myWalletAccount);

  return (
    <div className="relative">
      {!myWalletAccount && (
        <div className="mb-4 flex flex-col gap-3 rounded-3xl border border-white/[0.07] bg-white/[0.028] backdrop-blur-xl p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-md">
            <div className="font-[family-name:var(--font-display)] text-[17px] font-semibold text-[#eaf0f8]">
              Connect a wallet to use this panel
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-[#7a859c]">
              The preview below is live. Nothing is signed until you approve it in Ready, and
              submitting stays disabled until a wallet is linked.
            </p>
          </div>
          <div className="shrink-0">
            <SelectWallet variant="ctaBig" />
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

export function AccountChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/';
  const address = useStoreWallet((s) => s.address);
  const myWalletAccount = useStoreWallet((s) => s.myWalletAccount);
  const network = useStoreWallet((s) => s.network);
  const net: NetworkKey = network ?? 'sepolia';

  const [shielded, setShielded] = useState<string | null>(null);
  const [publicGas, setPublicGas] = useState<string | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const refresh = useCallback(async () => {
    if (!myWalletAccount || !address) return;
    setBalancesLoading(true);
    try {
      const [priv, pub] = await Promise.all([
        readPrivateBalance(myWalletAccount, TOKENS.STRK.address),
        getPublicBalance(net, TOKENS.STRK.address, address),
      ]);
      setShielded(fromBaseUnits(priv, TOKENS.STRK.decimals));
      setPublicGas(fromBaseUnits(pub, TOKENS.STRK.decimals));
    } catch {
      setShielded(null);
      setPublicGas(null);
    } finally {
      setBalancesLoading(false);
    }
  }, [myWalletAccount, address, net]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const shieldedNumber = shielded !== null ? Number(shielded) : null;
  const shieldedIsTickable = shieldedNumber !== null && Number.isFinite(shieldedNumber);

  const activePrimary = primaryForPath(pathname);
  const secondaryRoutes = ROUTE_GROUPS[activePrimary] ?? [];
  const activePrimaryLabel = PRIMARY_ROUTES.find((r) => r.href === activePrimary)?.label ?? '';

  return (
    <div className="vault-bg min-h-[100dvh] text-[#eaf0f8] flex flex-col font-[family-name:var(--font-body)]">
      <header className="sticky top-0 z-40 border-b border-white/[0.06] backdrop-blur-md">
        <div className="max-w-[1280px] mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="font-[family-name:var(--font-display)] text-[15px] font-semibold uppercase tracking-[0.14em] bg-gradient-to-r from-[#2dd4bf] via-[#38bdf8] to-[#818cf8] bg-clip-text text-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2dd4bf]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06070b] rounded-sm"
            >
              Sealed
            </Link>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#7a859c] px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/[0.07]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              {net}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <SelectWallet variant="nav" />
          </div>
        </div>
      </header>

      <div className="max-w-[1280px] w-full mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 flex-1 items-start">
        <aside className="flex flex-col gap-4 lg:sticky lg:top-[76px]">
          <div className="relative rounded-3xl border border-white/[0.07] bg-white/[0.03] backdrop-blur-xl elevate-2 p-7 overflow-hidden">
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(140%_120%_at_50%_-30%,rgba(45,212,191,0.09),transparent_60%)]" />
            <div className="relative">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7a859c]">
                Shielded
              </div>
              <div className="mt-3 flex items-center gap-3">
                {balancesLoading && shielded === null ? (
                  <Skeleton className="h-11 w-40" />
                ) : (
                  <span
                    className="font-[family-name:var(--font-display)] text-[44px] leading-none tracking-[-0.02em] tabular-nums bg-gradient-to-r from-[#2dd4bf] via-[#5eead4] to-[#67e8f9] bg-clip-text text-transparent transition-[filter] duration-300 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2dd4bf]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06070b] rounded-lg"
                    style={{ filter: revealed ? 'none' : 'blur(10px)' }}
                    onClick={() => setRevealed((r) => !r)}
                    onKeyDown={(e) => e.key === 'Enter' && setRevealed((r) => !r)}
                    role="button"
                    tabIndex={0}
                    aria-pressed={revealed}
                    aria-label="Toggle shielded balance visibility"
                  >
                    {revealed
                      ? shieldedIsTickable
                        ? <NumberTicker value={shieldedNumber as number} decimals={shieldedNumber! % 1 === 0 ? 0 : 4} />
                        : (shielded ?? 'Unavailable')
                      : '••••••'}
                  </span>
                )}
                <button
                  type="button"
                  className="h-9 rounded-full border border-white/[0.12] bg-white/[0.04] px-3 text-[11px] font-semibold text-[#eaf0f8] hover:bg-white/[0.09] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2dd4bf]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06070b]"
                  onClick={() => setRevealed((r) => !r)}
                  aria-label="Toggle shielded balance visibility"
                  aria-pressed={revealed}
                >
                  {revealed ? 'Hide' : 'Show'}
                </button>
              </div>
              <div className="mt-2.5 text-[13px] text-[#7a859c]">
                Shielded STRK{revealed ? '' : ' · hidden until you reveal'}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.028] backdrop-blur-xl elevate-1 p-5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7a859c]">
              Public gas
            </div>
            <div className="mt-1.5 font-[family-name:var(--font-mono-ui)] text-[16px] tabular-nums">
              {balancesLoading && publicGas === null ? (
                <Skeleton className="mt-0.5 h-5 w-24" />
              ) : (
                <>
                  {publicGas ?? 'Unavailable'} <span className="text-[#7a859c]">STRK</span>
                </>
              )}
            </div>
          </div>

          <p className="text-[12px] leading-relaxed text-[#7a859c] px-1">
            Your balance is encrypted on-chain. The pool never sees amounts or recipients.
          </p>
        </aside>

        <main className="flex flex-col gap-3 min-w-0">
          <nav
            className="flex gap-1 p-1 rounded-2xl bg-white/[0.03] border border-white/[0.06] w-fit max-w-full overflow-x-auto"
            aria-label="Account"
          >
            {PRIMARY_ROUTES.map((item) => {
              const isActive = primaryForPath(pathname) === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`${TAB_BTN} ${isActive ? TAB_ON : TAB_OFF}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {secondaryRoutes.length > 0 && (
            <nav
              className="flex gap-0.5 w-fit max-w-full overflow-x-auto"
              aria-label={`${activePrimaryLabel} sections`}
            >
              {secondaryRoutes.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={navActive(pathname, item.href) ? 'page' : undefined}
                  className={`${SUBTAB_BTN} ${navActive(pathname, item.href) ? SUBTAB_ON : SUBTAB_OFF}`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}

          <RouteTransition>{children}</RouteTransition>
        </main>
      </div>
    </div>
  );
}
