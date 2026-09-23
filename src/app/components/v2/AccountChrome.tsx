'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStoreWallet } from '../Wallet/walletContext';
import SelectWallet from '../client/WalletHandle/SelectWallet';
import { readPrivateBalance } from '../lib/strk20';
import { getPublicBalance, providerFor, TOKENS, type NetworkKey } from '@/utils/constants';
import { fromBaseUnits, shortHex } from '../lib/format';
import { ui } from '../lib/panelUi';
import { PRIMARY_ROUTES, ROUTE_GROUPS, primaryForPath } from './accountRoutes';
import {
  cx,
  Figure,
  HowThisWorks,
  LedgerRow,
  PanelState,
  PaperSheet,
  Redacted,
  RouteTransition,
  Skeleton,
} from './ui';
import { NetworkChip } from '../Panels/PoolFacts';
import { TestnetNotice } from '../marketing/TestnetNotice';

const TAB_BTN =
  'rounded-[4px] px-3.5 py-2 text-[13px] font-semibold whitespace-nowrap transition-[color,background-color,border-color,transform] duration-150 border active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--seal-text)] focus-visible:ring-offset-2 focus-visible:ring-offset-chrome';
const TAB_ON = 'border-[var(--seal-soft-2)] bg-[var(--seal-soft)] text-seal-bright';
const TAB_OFF =
  'border-transparent text-muted hover:text-ink hover:border-[var(--line)] hover:bg-white/[0.035]';

const SUBTAB_BTN =
  'rounded-[4px] px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-[color,background-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--seal-text)] focus-visible:ring-offset-2 focus-visible:ring-offset-chrome';
const SUBTAB_ON = 'text-ink bg-white/[0.06]';
const SUBTAB_OFF = 'text-muted hover:text-ink hover:bg-white/[0.035]';

function navActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Pre-connect, a tab still previews what it does: the panel renders, the live
 * pool reads still run, and only the submit controls are gated.
 *
 * This used to open with a 71-word paragraph repeated verbatim at the top of
 * every route, which read as one copy-pasted wall rather than as framing for
 * the panel underneath it. The caveats it carried are all still here, one
 * click down, where a footnote belongs on a document.
 */
export function AccountConnectWall({ children }: { children: ReactNode }) {
  const myWalletAccount = useStoreWallet((s) => s.myWalletAccount);

  return (
    <div className="relative">
      {!myWalletAccount && (
        <div className="doc mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[15px] leading-snug text-ink">
              Live and read-only. Link Ready to move money.
            </p>
            <HowThisWorks className="mt-1.5" label="Why Ready specifically">
              <p>
                Nothing is signed until you approve it in Ready, and submitting stays disabled
                until a wallet is linked. Ready generates and holds your viewing key on your
                device and produces the proofs behind every private action. That is why it is
                required for these, even though other Starknet wallets can hold your public funds.
              </p>
            </HowThisWorks>
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
  const [shieldedError, setShieldedError] = useState<string | null>(null);
  const [publicGas, setPublicGas] = useState<string | null>(null);
  const [publicGasError, setPublicGasError] = useState<string | null>(null);
  const [block, setBlock] = useState<number | null>(null);
  const [readAt, setReadAt] = useState<Date | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const refresh = useCallback(async () => {
    if (!myWalletAccount || !address) return;
    setBalancesLoading(true);
    setShieldedError(null);
    setPublicGasError(null);
    // Settled independently, not Promise.all. The private read scans notes and
    // can take a minute or hang outright on some routes; with Promise.all a
    // slow private read also withheld the public balance, so both sat as
    // skeletons forever and the account looked empty rather than loading.
    // Each balance now lands as soon as its own read returns.
    const privatePromise = readPrivateBalance(myWalletAccount, TOKENS.STRK.address)
      .then((priv) => setShielded(fromBaseUnits(priv, TOKENS.STRK.decimals)))
      .catch((err: any) => {
        setShielded(null);
        setShieldedError(err?.message ?? 'The wallet did not return a shielded balance.');
      });
    const publicPromise = getPublicBalance(net, TOKENS.STRK.address, address)
      .then((pub) => setPublicGas(fromBaseUnits(pub, TOKENS.STRK.decimals)))
      .catch((err: any) => {
        setPublicGas(null);
        setPublicGasError(err?.message ?? 'The RPC did not answer.');
      });
    // The block these balances were read at. Without it the figures are a
    // claim with no timestamp, which is the shape of a number that quietly
    // stopped being true.
    const blockPromise = providerFor(net)
      .getBlockNumber()
      .then((b) => setBlock(b))
      .catch(() => setBlock(null));

    await Promise.allSettled([privatePromise, publicPromise, blockPromise]);
    setReadAt(new Date());
    setBalancesLoading(false);
  }, [myWalletAccount, address, net]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const connected = Boolean(myWalletAccount && address);
  const shieldedLoading = connected && balancesLoading && shielded === null && !shieldedError;

  const activePrimary = primaryForPath(pathname);
  const secondaryRoutes = ROUTE_GROUPS[activePrimary] ?? [];
  const activePrimaryLabel = PRIMARY_ROUTES.find((r) => r.href === activePrimary)?.label ?? '';

  return (
    <div className="vault-bg min-h-[100dvh] text-ink flex flex-col font-[family-name:var(--font-body)]">
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-chrome/95">
        <TestnetNotice />
        <div className="max-w-[1280px] mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/app"
              className="font-[family-name:var(--font-display)] text-[22px] leading-none tracking-[-0.015em] rounded-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--seal-text)] focus-visible:ring-offset-2 focus-visible:ring-offset-chrome"
            >
              {/* The domain is the brand: people retype "sealed.cash", not "SEALED". */}
              <span className="text-ink">Sealed</span>
              <span className="text-muted">.cash</span>
            </Link>
            {/* Printed "mainnet testnet" on a mainnet wallet, which read as a
                claim that the live pool is a test one. */}
            <NetworkChip network={net} />
          </div>
          <div className="flex items-center gap-2">
            <SelectWallet variant="nav" />
          </div>
        </div>
      </header>

      <div className="max-w-[1280px] w-full mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 flex-1 items-start">
        <aside className="flex flex-col gap-4 lg:sticky lg:top-[84px]">
          {/*
            The statement. Everything that states a fact about your money sits
            on cream paper inside the graphite chrome: that contrast is the
            product's argument, that the public ledger is the dark surround and
            your balance is the lit sheet only you can read.
          */}
          <PaperSheet className="p-5 sm:p-6">
            <div className="flex items-baseline justify-between gap-3 border-b border-[var(--paper-line)] pb-3">
              <span className="font-[family-name:var(--font-display)] text-[22px] leading-none tracking-[-0.015em] text-paper-ink">
                Statement
              </span>
              <Figure className="text-[13px] text-paper-muted">
                {net === 'mainnet' ? 'mainnet' : 'sepolia'}
              </Figure>
            </div>

            <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-paper-muted">
              Shielded balance
            </div>

            <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-2">
              {shieldedLoading ? (
                <Skeleton className="skeleton-paper h-[40px] w-44" />
              ) : (
                <span className="figure text-[32px] sm:text-[40px] font-semibold leading-none tracking-[-0.025em] text-paper-ink">
                  <Redacted
                    revealed={connected && revealed && shielded !== null}
                    srLabel={
                      connected
                        ? 'Shielded balance hidden. Use Reveal to show it.'
                        : 'Shielded balance withheld until a wallet is linked.'
                    }
                    className={connected && shielded !== null ? undefined : 'w-[6.5ch]'}
                  >
                    {/* No wallet means no number, so the bar covers a blank,
                        never an invented figure. */}
                    {connected && shielded !== null ? shielded : '\u00a0'}
                  </Redacted>
                </span>
              )}
              <span className="figure pb-0.5 text-[13px] text-paper-muted">STRK</span>
              {connected && shielded !== null ? (
                <button
                  type="button"
                  className="ml-auto rounded-[4px] border border-[var(--paper-line)] px-3 py-1.5 text-[13px] font-semibold text-paper-ink transition-[background-color,transform] duration-150 hover:bg-[var(--paper-2)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--seal)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)]"
                  onClick={() => setRevealed((r) => !r)}
                  aria-pressed={revealed}
                >
                  {revealed ? 'Redact' : 'Reveal'}
                </button>
              ) : null}
            </div>

            {!connected ? (
              <p className="mt-3 text-[13px] leading-relaxed text-paper-muted">
                Withheld, not empty. Link a wallet and the bar lifts for you alone; the pool
                never sees the figure under it.
              </p>
            ) : shieldedError ? (
              <PanelState
                kind="error"
                tone="paper"
                title="Could not read your shielded balance"
                className="mt-3"
              >
                {shieldedError} Reconnect Ready and reopen this page to try the note scan again.
              </PanelState>
            ) : shielded !== null && Number(shielded) === 0 ? (
              <p className="mt-3 text-[13px] leading-relaxed text-paper-muted">
                Nothing shielded yet. Deposit STRK below and it moves behind your viewing key.
              </p>
            ) : (
              <p className="mt-3 text-[13px] leading-relaxed text-paper-muted">
                {revealed
                  ? 'Visible on this device only. Nobody reading the chain can see this figure.'
                  : 'Hidden. Only this device holds the viewing key that lifts the bar.'}
              </p>
            )}

            <div className="mt-5 border-t border-[var(--paper-line)] pt-1">
              <LedgerRow
                tone="paper"
                label="Public gas"
                hint="plain STRK in your wallet, visible to anyone"
              >
                {!connected ? (
                  'wallet not linked'
                ) : balancesLoading && publicGas === null && !publicGasError ? (
                  <Skeleton className="skeleton-paper inline-block h-4 w-20 align-middle" />
                ) : publicGasError ? (
                  <span className="text-seal">read failed</span>
                ) : (
                  `${publicGas} STRK`
                )}
              </LedgerRow>
              <LedgerRow tone="paper" label="Account">
                {connected && address ? shortHex(address) : 'not linked'}
              </LedgerRow>
              <LedgerRow tone="paper" label="Read at block">
                {connected && block !== null ? block.toLocaleString('en-US') : 'not read'}
              </LedgerRow>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--paper-line)] pt-3">
              <p className="text-[13px] text-paper-muted">
                {connected && readAt ? (
                  <>
                    <Figure>{readAt.toLocaleTimeString('en-US', { hour12: false })}</Figure> local,
                    from {net === 'mainnet' ? 'Starknet mainnet' : 'Starknet Sepolia'}.
                  </>
                ) : (
                  <>No wallet read yet.</>
                )}
              </p>
              {connected ? (
                <button
                  type="button"
                  className="rounded-[4px] border border-[var(--paper-line)] px-2.5 py-1 text-[13px] font-semibold text-paper-ink transition-[background-color,transform] duration-150 hover:bg-[var(--paper-2)] active:scale-[0.97] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--seal)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)]"
                  onClick={refresh}
                  disabled={balancesLoading}
                >
                  {balancesLoading ? 'Re-reading…' : 'Re-read'}
                </button>
              ) : null}
            </div>
          </PaperSheet>

          <p className={cx(ui.note, 'px-1')}>
            Your balance is encrypted on-chain. The pool never sees amounts or recipients.
          </p>
        </aside>

        <main className="flex flex-col gap-3 min-w-0">
          <nav
            className="flex gap-1 w-fit max-w-full overflow-x-auto border-b border-[var(--line)] pb-2"
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
