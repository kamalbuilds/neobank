'use client';

import { useState } from 'react';
import HopPanel from '../components/Panels/HopPanel';
import InboundPanel from '../components/Panels/InboundPanel';
import { useStoreWallet } from '../components/Wallet/walletContext';
import { type NetworkKey } from '@/utils/constants';
import { AccountChrome, AccountConnectWall } from '../components/v2/AccountChrome';

type FundDirection = 'inbound' | 'outbound';

const DIR_BTN =
  'px-3.5 py-2 rounded-[3px] text-[13px] whitespace-nowrap transition-[background-color,color] duration-150 focus-visible:outline-none';
const DIR_ON = 'bg-paper text-paper-ink font-semibold';
const DIR_OFF = 'text-muted font-medium hover:text-ink hover:bg-white/[0.04]';

export function FundClient() {
  const network = useStoreWallet((s) => s.network);
  const net: NetworkKey = network ?? 'sepolia';
  const [direction, setDirection] = useState<FundDirection>('inbound');

  return (
    <AccountChrome>
      <div
        className="mb-4 flex w-fit max-w-full gap-1 overflow-x-auto rounded-[4px] border border-[color:var(--line)] bg-white/[0.02] p-1"
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
          Bring in · Base to Starknet
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={direction === 'outbound'}
          className={`${DIR_BTN} ${direction === 'outbound' ? DIR_ON : DIR_OFF}`}
          onClick={() => setDirection('outbound')}
        >
          Send out · Starknet to Base/Solana
        </button>
      </div>

      {direction === 'inbound' ? (
        // Inbound runs on the hosted account server-side: no user wallet needed.
        <div className="doc p-4 min-h-[380px] sm:p-6">
          <InboundPanel network={net} />
        </div>
      ) : (
        <AccountConnectWall>
          <div className="doc p-4 min-h-[380px] sm:p-6">
            <HopPanel network={net} />
          </div>
        </AccountConnectWall>
      )}
    </AccountChrome>
  );
}
