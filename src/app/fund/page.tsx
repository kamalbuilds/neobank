'use client';

import { useState } from 'react';
import HopPanel from '../components/Panels/HopPanel';
import InboundPanel from '../components/Panels/InboundPanel';
import { useStoreWallet } from '../components/Wallet/walletContext';
import { type NetworkKey } from '@/utils/constants';
import { AccountChrome, AccountConnectWall } from '../components/v2/AccountChrome';

type FundDirection = 'inbound' | 'outbound';

const DIR_BTN =
  'px-3.5 py-2 rounded-xl text-[13px] font-medium whitespace-nowrap transition-colors';
const DIR_ON =
  'text-[#04140f] bg-gradient-to-br from-[#2dd4bf] to-[#38bdf8] font-semibold shadow-[0_4px_16px_-6px_rgba(45,212,191,0.5)]';
const DIR_OFF = 'text-[#7a859c] hover:text-[#eaf0f8]';

export default function FundPage() {
  const network = useStoreWallet((s) => s.network);
  const net: NetworkKey = network ?? 'sepolia';
  const [direction, setDirection] = useState<FundDirection>('inbound');

  return (
    <AccountChrome>
      <div
        className="mb-4 flex w-fit gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.028] p-1"
        role="tablist"
        aria-label="Funding direction"
      >
        <button
          type="button"
          role="tab"
          aria-selected={direction === 'inbound'}
          className={`${DIR_BTN} ${direction === 'inbound' ? DIR_ON : DIR_OFF}`}
          onClick={() => setDirection('inbound')}
        >
          Bring in · Base → Starknet
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={direction === 'outbound'}
          className={`${DIR_BTN} ${direction === 'outbound' ? DIR_ON : DIR_OFF}`}
          onClick={() => setDirection('outbound')}
        >
          Send out · Starknet → Base/Solana
        </button>
      </div>

      {direction === 'inbound' ? (
        // Inbound runs on the hosted account server-side: no user wallet needed.
        <div className="rounded-3xl border border-white/[0.07] bg-white/[0.028] backdrop-blur-xl p-6 min-h-[380px]">
          <InboundPanel network={net} />
        </div>
      ) : (
        <AccountConnectWall>
          <div className="rounded-3xl border border-white/[0.07] bg-white/[0.028] backdrop-blur-xl p-6 min-h-[380px]">
            <HopPanel network={net} />
          </div>
        </AccountConnectWall>
      )}
    </AccountChrome>
  );
}
