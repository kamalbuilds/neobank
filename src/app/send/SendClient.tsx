'use client';

import SendPanel from '../components/Panels/SendPanel';
import { useStoreWallet } from '../components/Wallet/walletContext';
import { type NetworkKey } from '@/utils/constants';
import { AccountChrome, AccountConnectWall } from '../components/v2/AccountChrome';
import { Redacted } from '../components/v2/ui';

export function SendClient() {
  const network = useStoreWallet((s) => s.network);
  const myWalletAccount = useStoreWallet((s) => s.myWalletAccount);
  const net: NetworkKey = network ?? 'sepolia';

  return (
    <AccountChrome>
      <AccountConnectWall>
        {!myWalletAccount && (
          <div className="doc mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 p-5">
            <span className="text-[13px] text-muted">Shielded STRK you can send</span>
            <span className="figure text-[15px] font-bold text-ink">
              <Redacted
                revealed={false}
                tone="chrome"
                className="w-[120px]"
                srLabel="Withheld until a wallet is linked"
              >
                {' '}
              </Redacted>
            </span>
            <p className="w-full text-[13px] leading-relaxed text-muted">
              Withheld, not empty. The figure is encrypted on chain and only your viewing key
              decrypts it, so link Ready above and it reads from your own notes.
            </p>
          </div>
        )}
        <div className="doc p-4 min-h-[380px] sm:p-6">
          <SendPanel network={net} />
        </div>
      </AccountConnectWall>
    </AccountChrome>
  );
}
