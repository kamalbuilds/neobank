'use client';

import { useCallback, useEffect, useState } from 'react';
import SwapPanel from '../components/Panels/SwapPanel';
import { useStoreWallet } from '../components/Wallet/walletContext';
import { type NetworkKey } from '@/utils/constants';
import { AccountChrome, AccountConnectWall } from '../components/v2/AccountChrome';
import { Redacted, Skeleton } from '../components/v2/ui';

type RouterState =
  | { phase: 'checking' }
  | { phase: 'configured' }
  | { phase: 'unconfigured' }
  | { phase: 'unreachable'; message: string };

/**
 * The swap route depends on a server-held AVNU paymaster key. Without it the
 * server answers 503 and the panel can only refuse, so the refusal is rendered
 * here as its own state rather than left as a blank panel: what is off, what
 * still works, and what the operator has to set.
 */
export function ConvertClient() {
  const network = useStoreWallet((s) => s.network);
  const myWalletAccount = useStoreWallet((s) => s.myWalletAccount);
  const net: NetworkKey = network ?? 'sepolia';
  const [router, setRouter] = useState<RouterState>({ phase: 'checking' });

  const check = useCallback(async () => {
    setRouter({ phase: 'checking' });
    try {
      const response = await fetch('/api/avnu/status', { cache: 'no-store' });
      if (!response.ok) {
        setRouter({
          phase: 'unreachable',
          message: `The router status endpoint answered ${response.status}.`,
        });
        return;
      }
      const body = (await response.json()) as { configured?: boolean };
      setRouter({ phase: body.configured ? 'configured' : 'unconfigured' });
    } catch (error) {
      setRouter({
        phase: 'unreachable',
        message:
          error instanceof Error ? error.message : 'The router status endpoint did not answer.',
      });
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  return (
    <AccountChrome>
      <div aria-live="polite" className="mb-4">
        {router.phase === 'checking' && (
          <div className="doc p-5" aria-busy="true" aria-label="Checking the swap router">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="mt-3 h-4 w-full max-w-md" />
          </div>
        )}

        {(router.phase === 'unconfigured' || router.phase === 'unreachable') && (
          <div
            className="doc border-l-2 border-l-[color:var(--seal)] p-5"
            role="status"
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-seal-bright">
              Convert is off on this deployment
            </div>
            <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-ink">
              {router.phase === 'unconfigured'
                ? 'The private swap runs through AVNU’s paymaster, and this server has no paymaster key set. Quotes and conversions will be refused rather than half-executed.'
                : router.message}
            </p>
            <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted">
              Everything else on the account still works: shield, send, spend and unshield do not
              touch the router. Set{' '}
              <span className="figure text-[13px] font-semibold text-ink">AVNU_PAYMASTER_API_KEY</span> on the
              server to turn this panel back on.
            </p>
            <button
              type="button"
              onClick={() => void check()}
              className="mt-4 h-9 rounded-[4px] border border-[color:var(--line-strong)] px-3.5 text-[13px] font-semibold text-ink transition-[background-color,transform] duration-150 hover:bg-white/[0.05] active:scale-[0.97]"
            >
              Check again
            </button>
          </div>
        )}
      </div>

      <AccountConnectWall>
        {!myWalletAccount && (
          <div className="doc mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 p-5">
            <span className="text-[13px] text-muted">Shielded STRK you can convert</span>
            <span className="figure text-[15px] font-bold text-ink">
              <Redacted
                revealed={false}
                tone="chrome"
                className="w-[120px]"
                srLabel="Withheld until a wallet is linked"
              >
                {' '}
              </Redacted>
            </span>
            <p className="w-full text-[13px] leading-relaxed text-muted">
              Withheld, not empty. The figure is encrypted on chain and only your viewing key
              decrypts it, so link Ready above and it reads from your own notes.
            </p>
          </div>
        )}
        <div className="doc p-4 min-h-[380px] sm:p-6">
          <SwapPanel network={net} />
        </div>
      </AccountConnectWall>
    </AccountChrome>
  );
}
