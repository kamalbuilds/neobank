'use client';

import ReceivePanel from '../components/Panels/ReceivePanel';
import { useStoreWallet } from '../components/Wallet/walletContext';
import { AccountChrome, AccountConnectWall } from '../components/v2/AccountChrome';
import { Redacted } from '../components/v2/ui';

export function ReceiveClient() {
  const myWalletAccount = useStoreWallet((s) => s.myWalletAccount);

  return (
    <AccountChrome>
      <AccountConnectWall>
        {!myWalletAccount && (
          <div className="doc mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 p-5">
            <span className="text-[13px] text-muted">The address people would pay you at</span>
            <span className="figure text-[15px] font-bold text-ink">
              <Redacted
                revealed={false}
                tone="chrome"
                className="w-[180px]"
                srLabel="Withheld until a wallet is linked"
              >
                {' '}
              </Redacted>
            </span>
            <p className="w-full text-[13px] leading-relaxed text-muted">
              Withheld, not empty. The address belongs to the wallet, so link Ready above and the
              panel below prints it with its QR code.
            </p>
          </div>
        )}
        <div className="doc p-4 min-h-[380px] sm:p-6">
          <ReceivePanel />
        </div>
      </AccountConnectWall>
    </AccountChrome>
  );
}
