'use client';

import ReceivePanel from '../components/Panels/ReceivePanel';
import { AccountChrome, AccountConnectWall } from '../components/v2/AccountChrome';

export default function ReceivePage() {
  return (
    <AccountChrome>
      <AccountConnectWall>
        <div className="rounded-3xl border border-white/[0.07] bg-white/[0.028] backdrop-blur-xl p-6 min-h-[380px]">
          <ReceivePanel />
        </div>
      </AccountConnectWall>
    </AccountChrome>
  );
}
