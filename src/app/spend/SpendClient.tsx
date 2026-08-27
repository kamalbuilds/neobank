'use client';

import SpendPanel from '../components/Panels/SpendPanel';
import { useStoreWallet } from '../components/Wallet/walletContext';
import { type NetworkKey } from '@/utils/constants';
import { AccountChrome, AccountConnectWall } from '../components/v2/AccountChrome';

export function SpendClient() {
  const network = useStoreWallet((s) => s.network);
  const net: NetworkKey = network ?? 'sepolia';

  return (
    <AccountChrome>
      <AccountConnectWall>
        <div className="rounded-3xl border border-white/[0.07] bg-white/[0.028] backdrop-blur-xl elevate-1 p-6 min-h-[380px]">
          <SpendPanel network={net} />
        </div>
      </AccountConnectWall>
    </AccountChrome>
  );
}
