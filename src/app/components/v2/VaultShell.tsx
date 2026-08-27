'use client';

import ShieldPanel from '../Panels/ShieldPanel';
import ActivityPanel from '../Panels/ActivityPanel';
import { useStoreWallet } from '../Wallet/walletContext';
import { type NetworkKey } from '@/utils/constants';
import { AccountChrome, AccountConnectWall } from './AccountChrome';

/** Hold route: shield + balances (via chrome) + activity. */
export function VaultShell() {
  const network = useStoreWallet((s) => s.network);
  const net: NetworkKey = network ?? 'sepolia';

  return (
    <AccountChrome>
      <AccountConnectWall>
        <div className="rounded-3xl border border-white/[0.07] bg-white/[0.028] backdrop-blur-xl elevate-1 p-6 min-h-[380px]">
          <ShieldPanel network={net} />
        </div>
      </AccountConnectWall>

      <div className="rounded-3xl border border-white/[0.07] bg-white/[0.028] backdrop-blur-xl elevate-1 p-6">
        <ActivityPanel network={net} />
      </div>
    </AccountChrome>
  );
}
