'use client';

import { useState, useEffect, useCallback } from 'react';
import { useStoreWallet } from '../Wallet/walletContext';
import ShieldPanel from '../Panels/ShieldPanel';
import SpendPanel from '../Panels/SpendPanel';
import SendPanel from '../Panels/SendPanel';
import ReceivePanel from '../Panels/ReceivePanel';
import SwapPanel from '../Panels/SwapPanel';
import HopPanel from '../Panels/HopPanel';
import ActivityPanel from '../Panels/ActivityPanel';
import UnshieldPanel from '../Panels/UnshieldPanel';
import { readPrivateBalance } from '../lib/strk20';
import { getPublicBalance, TOKENS } from '@/utils/constants';
import { fromBaseUnits } from '../lib/format';
import styles from './VaultShell.module.css';

type Flow = 'shield' | 'spend' | 'send' | 'receive' | 'swap' | 'hop' | 'unshield' | 'activity';

export function VaultShell() {
  const {
    address,
    myWalletAccount,
    strk20Capable,
  } = useStoreWallet();

  const [flow, setFlow] = useState<'shield' | 'spend' | 'send' | 'receive' | 'swap' | 'hop' | 'unshield' | 'activity'>('shield');
  const [shieldedBalance, setShieldedBalance] = useState<string>('\u2014');
  const [revealed, setRevealed] = useState(false);
  const [publicBalance, setPublicBalance] = useState<string>('\u2014');

  const revealHandler = useCallback(() => {
    setRevealed(r => !r);
  }, []);

  useEffect(() => {
    if (!myWalletAccount || !address) return;
    const load = async () => {
      try {
        const [shielded, publicStrk] = await Promise.all([
          readPrivateBalance(myWalletAccount as any, TOKENS.STRK.address),
          getPublicBalance('sepolia', TOKENS.STRK.address, address),
        ]);
        setShieldedBalance(fromBaseUnits(shielded, TOKENS.STRK.decimals));
        setPublicBalance(fromBaseUnits(publicStrk, TOKENS.STRK.decimals));
      } catch {
        setShieldedBalance('\u2014');
        setPublicBalance('\u2014');
      }
    };
    load();
  }, [myWalletAccount, address]);

  const connected = !!myWalletAccount;

  const panels: Record<string, React.ReactNode> = {
    shield: <ShieldPanel network="sepolia" />,
    spend: <SpendPanel network="sepolia" />,
    send: <SendPanel network="sepolia" />,
    receive: <ReceivePanel />,
    swap: <SwapPanel network="sepolia" />,
    hop: <HopPanel network="sepolia" />,
    unshield: <UnshieldPanel network="sepolia" />,
    activity: <ActivityPanel network="sepolia" />,
  };

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <span className={styles.brandMark}>VAULT</span>
          <span className={styles.networkChip} aria-label="Starknet Sepolia">
            <span className={styles.dot} aria-hidden="true" />
            SEPOLIA
          </span>
        </div>
        <div className={styles.topbarRight}>
          <button
            className={styles.addrPill}
            aria-label="Copy address"
            onClick={() => navigator.clipboard.writeText(address)}
            disabled={!address}
          >
            <span className={styles.addrDot} aria-hidden="true" />
            {address?.slice(0, 6)}\u2026{address?.slice(-4)}
          </button>
        </div>
      </header>

      <div className={styles.grid}>
        <aside className={styles.rail} aria-label="Account overview">
          <div className={styles.balanceCard}>
            <div className={styles.balanceLabel}>SHIELDED</div>
            <div className={styles.balanceRow}>
              <span
                className={styles.balanceValue}
                style={{ filter: revealed ? 'none' : 'blur(8px)' }}
                onClick={() => setRevealed(r => !r)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && setRevealed(r => !r)}
                aria-label={revealed ? 'Hide shielded balance' : 'Reveal shielded balance'}
                aria-pressed={revealed}
              >
                {revealed ? shieldedBalance : '\u2022\u2022\u2022\u2022\u2022\u2022'}
              </span>
              <button
                className={styles.revealBtn}
                onClick={() => setRevealed(r => !r)}
                aria-label={revealed ? 'Hide shielded balance' : 'Reveal shielded balance'}
                aria-pressed={revealed}
              >
                {revealed ? '\uD83D\uDE48' : '\uD83D\uDC41\uFE0F'}
              </button>
            </div>
            <div className={styles.balanceSub}>Shielded STRK</div>
          </div>

          <div className={styles.publicCard}>
            <span className={styles.publicLabel}>PUBLIC GAS</span>
            <div className={styles.publicValue}>{publicBalance} STRK</div>
          </div>

          <div className={styles.privacyNote}>
            Your balance is encrypted on-chain.<br />
            The pool never sees amounts or recipients.
          </div>
        </aside>

        <main className={styles.deck}>
          <nav className={styles.flowTabs} aria-label="Actions">
            <button
              className={flow === 'shield' ? 'active' : ''}
              onClick={() => setFlow('shield')}
            >Shield</button>
            <button onClick={() => setFlow('spend')}>Spend</button>
            <button onClick={() => setFlow('send')}>Send</button>
            <button onClick={() => setFlow('receive')}>Receive</button>
            <button onClick={() => setFlow('swap')}>Swap</button>
            <button onClick={() => setFlow('hop')}>Hop</button>
            <button onClick={() => setFlow('unshield')}>Unshield</button>
            <button onClick={() => setFlow('activity')}>Activity</button>
          </nav>

          <div className={styles.panelWrapper}>
            <ShieldPanel network="sepolia" />
          </div>
        </main>
      </div>

      <footer className={styles.ledger}>
        <ActivityPanel network="sepolia" />
      </footer>
    </div>
  );
}
