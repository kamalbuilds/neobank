'use client';

import UnshieldPanel from '../components/Panels/UnshieldPanel';
import { useStoreWallet } from '../components/Wallet/walletContext';
import { type NetworkKey } from '@/utils/constants';
import { AccountChrome, AccountConnectWall } from '../components/v2/AccountChrome';

export default function UnshieldPage() {
  const network = useStoreWallet((s) => s.network);
  const net: NetworkKey = network ?? 'sepolia';

  return (
    <AccountChrome>
      <AccountConnectWall>
        <div className="rounded-3xl border border-white/[0.07] bg-white/[0.028] backdrop-blur-xl p-6 min-h-[380px]">
          <UnshieldPanel network={net} />
        </div>
      </AccountConnectWall>
    </AccountChrome>
  );
}
