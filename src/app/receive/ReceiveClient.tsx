'use client';

import ReceivePanel from '../components/Panels/ReceivePanel';
import { AccountChrome, AccountConnectWall } from '../components/v2/AccountChrome';

export function ReceiveClient() {
  return (
    <AccountChrome>
      <AccountConnectWall>
        <div className="rounded-3xl border border-white/[0.07] bg-white/[0.028] backdrop-blur-xl elevate-1 p-6 min-h-[380px]">
          <ReceivePanel />
        </div>
      </AccountConnectWall>
    </AccountChrome>
  );
}
