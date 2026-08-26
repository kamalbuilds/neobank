'use client';

import SwapPanel from '../components/Panels/SwapPanel';
import { useStoreWallet } from '../components/Wallet/walletContext';
import { type NetworkKey } from '@/utils/constants';
import { AccountChrome, AccountConnectWall } from '../components/v2/AccountChrome';

export default function ConvertPage() {
  const network = useStoreWallet((s) => s.network);
  const net: NetworkKey = network ?? 'sepolia';

  return (
    <AccountChrome>
      <AccountConnectWall>
        <div className="rounded-3xl border border-white/[0.07] bg-white/[0.028] backdrop-blur-xl p-6 min-h-[380px]">
          <SwapPanel network={net} />
        </div>
      </AccountConnectWall>
    </AccountChrome>
  );
}
