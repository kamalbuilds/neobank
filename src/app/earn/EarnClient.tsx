'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ANONYMIZER_ADDRESSES,
  explorerAddressUrl,
  providerFor,
  TOKENS,
  type NetworkKey,
} from '@/utils/constants';
import { withRetry } from '../components/lib/rpcRetry';
import { fromBaseUnits, shortHex } from '../components/lib/format';
import { AccountChrome } from '../components/v2/AccountChrome';
import { HowThisWorks, NumberTicker, Skeleton } from '../components/v2/ui';

const EARN_VAULT = ANONYMIZER_ADDRESSES.sepolia.earnVault;
const EXPECTED_VAULT =
  '0x076811f28a950b5c6ddaa02bd323b5fccb572676ff57bbc3b979a430f0acda8b';

async function readTotalAssets(network: NetworkKey, vault: string): Promise<bigint> {
  const provider = providerFor(network);
  const result = await withRetry(() =>
    provider.callContract({
      contractAddress: vault,
      entrypoint: 'total_assets',
      calldata: [],
    }),
  );
  const low = BigInt(result[0]);
  const high = BigInt(result[1] ?? '0x0');
  return low + (high << 128n);
}

export function EarnClient() {
  const [totalAssets, setTotalAssets] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!EARN_VAULT) {
      setError('Earn vault is not configured on this network.');
      setTotalAssets(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const assets = await readTotalAssets('sepolia', EARN_VAULT);
      setTotalAssets(fromBaseUnits(assets, TOKENS.STRK.decimals));
    } catch (e) {
      setTotalAssets(null);
      setError(e instanceof Error ? e.message : 'Failed to read total_assets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const vault = EARN_VAULT ?? EXPECTED_VAULT;
  const totalAssetsNumber = totalAssets !== null ? Number(totalAssets) : null;
  const tickable = totalAssetsNumber !== null && Number.isFinite(totalAssetsNumber);

  return (
    <AccountChrome>
      <div className="rounded-3xl border border-white/[0.07] bg-white/[0.028] backdrop-blur-xl elevate-1 p-6 min-h-[380px] flex flex-col gap-6">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7a859c]">
            Earn
          </div>
          <h1 className="mt-2 text-balance font-[family-name:var(--font-display)] text-[28px] font-semibold tracking-[-0.02em] text-[#eaf0f8]">
            Card spend at restaurants funds this vault
          </h1>
          <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-[#7a859c]">
            Every time your card settles a restaurant purchase, 10 STRK from the hosted settlement
            account lends into this vault. The balance below is read live from the contract. No
            yield rate is shown because this vault doesn&apos;t publish one yet.
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] elevate-1 p-5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7a859c]">
            Vault balance
          </div>
          <div className="mt-2 font-[family-name:var(--font-display)] text-[40px] leading-none tracking-[-0.02em] tabular-nums bg-gradient-to-r from-[#2dd4bf] via-[#5eead4] to-[#67e8f9] bg-clip-text text-transparent">
            {loading ? (
              <Skeleton className="h-10 w-40" />
            ) : tickable ? (
              <NumberTicker value={totalAssetsNumber as number} decimals={totalAssetsNumber! % 1 === 0 ? 0 : 4} />
            ) : (
              (totalAssets ?? 'Unavailable')
            )}
            {!loading && totalAssets !== null ? (
              <span className="ml-2 text-[18px] text-[#7a859c]">STRK</span>
            ) : null}
          </div>
          {error ? (
            <p className="mt-3 text-[13px] text-[#f87171]" role="alert">{error}</p>
          ) : (
            <p className="mt-3 text-[13px] text-[#7a859c]">Read live from Sepolia. Refresh to re-check.</p>
          )}
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="mt-4 h-9 rounded-full border border-white/[0.12] bg-white/[0.04] px-4 text-[12px] font-semibold text-[#eaf0f8] transition-colors duration-150 hover:bg-white/[0.09] disabled:opacity-50 disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2dd4bf]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06070b]"
          >
            {loading ? 'Reading…' : 'Refresh'}
          </button>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] elevate-1 p-5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7a859c]">
            Vault contract
          </div>
          <a
            href={explorerAddressUrl('sepolia', vault)}
            target="_blank"
            rel="noreferrer"
            className="mt-2 block break-all font-[family-name:var(--font-mono-ui)] text-[13px] text-[#2dd4bf] hover:underline"
          >
            {vault}
          </a>
          <p className="mt-2 text-[12px] text-[#7a859c]">
            {shortHex(vault)}. This shows the vault&apos;s public total. The share earned from
            your card spend sits in the hosted account, which Sealed&apos;s operator can see - it
            is not part of your self-custody shielded balance.
          </p>
          <HowThisWorks className="mt-3" label="Where this number comes from">
            <p>
              Read via <span className="font-[family-name:var(--font-mono-ui)]">total_assets()</span>{' '}
              on the vault contract above, on Sepolia.
            </p>
          </HowThisWorks>
        </div>
      </div>
    </AccountChrome>
  );
}
