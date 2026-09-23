'use client';

import ShieldPanel from '../Panels/ShieldPanel';
import ActivityPanel from '../Panels/ActivityPanel';
import { useStoreWallet } from '../Wallet/walletContext';
import { type NetworkKey } from '@/utils/constants';
import { AccountChrome, AccountConnectWall } from './AccountChrome';
import { Panel } from './ui';

/** Hold route: shield + balances (via chrome) + activity. */
export function VaultShell() {
  const network = useStoreWallet((s) => s.network);
  const net: NetworkKey = network ?? 'sepolia';

  return (
    <AccountChrome>
      <AccountConnectWall>
        <Panel className="min-h-[380px]">
          <ShieldPanel network={net} />
        </Panel>
      </AccountConnectWall>

      <Panel className="mt-3">
        <ActivityPanel network={net} />
      </Panel>
    </AccountChrome>
  );
}
