'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStoreWallet } from '../Wallet/walletContext';
import SelectWallet from '../client/WalletHandle/SelectWallet';
import { readPrivateBalance } from '../lib/strk20';
import { getPublicBalance, TOKENS, type NetworkKey } from '@/utils/constants';
import { fromBaseUnits } from '../lib/format';
import { ACCOUNT_MOVE_ROUTES, ACCOUNT_ROUTES } from './accountRoutes';

const TAB_BTN =
  'px-3.5 py-2 rounded-xl text-[13px] font-medium whitespace-nowrap transition-colors';
const TAB_ON =
  'text-[#04140f] bg-gradient-to-br from-[#2dd4bf] to-[#38bdf8] font-semibold shadow-[0_4px_16px_-6px_rgba(45,212,191,0.5)]';
const TAB_OFF = 'text-[#7a859c] hover:text-[#eaf0f8]';

function navActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AccountConnectWall({ children }: { children: ReactNode }) {
  const myWalletAccount = useStoreWallet((s) => s.myWalletAccount);
  const network = useStoreWallet((s) => s.network);
  const net: NetworkKey = network ?? 'sepolia';

  if (myWalletAccount) return <>{children}</>;

  return (
    <div className="rounded-3xl border border-white/[0.07] bg-white/[0.028] backdrop-blur-xl p-8 min-h-[380px] flex flex-col items-center justify-center text-center gap-5">
      <div className="max-w-sm">
        <div className="font-[family-name:var(--font-display)] text-[22px] font-semibold text-[#eaf0f8]">
          Connect a wallet to begin
        </div>
        <p className="mt-2 text-[13.5px] leading-relaxed text-[#7a859c]">
          Connect Ready to shield {net === 'sepolia' ? 'test ' : ''}STRK or USDC and move value
          privately. Your first shield deploys and registers your account. Nothing is signed until
          you approve it in the wallet.
        </p>
      </div>
      <SelectWallet variant="ctaBig" />
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
  const [revealed, setRevealed] = useState(false);

  const refresh = useCallback(async () => {
    if (!myWalletAccount || !address) return;
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
    }
  }, [myWalletAccount, address, net]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="vault-bg min-h-[100dvh] text-[#eaf0f8] flex flex-col font-[family-name:var(--font-body)]">
      <header className="sticky top-0 z-40 border-b border-white/[0.06] backdrop-blur-md">
        <div className="max-w-[1280px] mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="font-[family-name:var(--font-display)] text-[15px] font-semibold uppercase tracking-[0.14em] bg-gradient-to-r from-[#2dd4bf] via-[#38bdf8] to-[#818cf8] bg-clip-text text-transparent"
            >
              VAULT
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
          <div className="relative rounded-3xl border border-white/[0.07] bg-white/[0.03] backdrop-blur-xl p-7 overflow-hidden">
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(140%_120%_at_50%_-30%,rgba(45,212,191,0.09),transparent_60%)]" />
            <div className="relative">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7a859c]">
                Shielded
              </div>
              <div className="mt-3 flex items-center gap-3">
                <span
                  className="font-[family-name:var(--font-display)] text-[44px] leading-none tracking-[-0.02em] tabular-nums bg-gradient-to-r from-[#2dd4bf] via-[#5eead4] to-[#67e8f9] bg-clip-text text-transparent transition-[filter] duration-300 cursor-pointer select-none"
                  style={{ filter: revealed ? 'none' : 'blur(10px)' }}
                  onClick={() => setRevealed((r) => !r)}
                  onKeyDown={(e) => e.key === 'Enter' && setRevealed((r) => !r)}
                  role="button"
                  tabIndex={0}
                  aria-pressed={revealed}
                  aria-label="Toggle shielded balance visibility"
                >
                  {revealed ? (shielded ?? 'Unavailable') : '••••••'}
                </span>
                <button
                  className="h-9 rounded-full border border-white/[0.12] bg-white/[0.04] px-3 text-[11px] font-semibold text-[#eaf0f8] hover:bg-white/[0.09] transition-colors"
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

          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.028] backdrop-blur-xl p-5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7a859c]">
              Public gas
            </div>
            <div className="mt-1.5 font-[family-name:var(--font-mono-ui)] text-[16px] tabular-nums">
              {publicGas ?? 'Unavailable'} <span className="text-[#7a859c]">STRK</span>
            </div>
          </div>

          <p className="text-[12px] leading-relaxed text-[#7a859c] px-1">
            Your balance is encrypted on-chain. The pool never sees amounts or recipients.
          </p>
        </aside>

        <main className="flex flex-col gap-4 min-w-0">
          <nav
            className="flex gap-1 p-1 rounded-2xl bg-white/[0.03] border border-white/[0.06] w-fit max-w-full overflow-x-auto"
            aria-label="Account"
          >
            {ACCOUNT_ROUTES.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`${TAB_BTN} ${navActive(pathname, item.href) ? TAB_ON : TAB_OFF}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <nav
            className="flex gap-1 p-1 rounded-2xl bg-white/[0.02] border border-white/[0.05] w-fit max-w-full overflow-x-auto"
            aria-label="Private moves"
          >
            {ACCOUNT_MOVE_ROUTES.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`${TAB_BTN} ${navActive(pathname, item.href) ? TAB_ON : TAB_OFF}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {children}
        </main>
      </div>
    </div>
  );
}
