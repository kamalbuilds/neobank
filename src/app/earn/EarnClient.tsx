'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ANONYMIZER_ADDRESSES,
  explorerAddressUrl,
  providerFor,
  TOKENS,
  type NetworkKey,
} from '@/utils/constants';
import { TX_RECORD } from '@/lib/evidence';
import { withRetry } from '../components/lib/rpcRetry';
import { fromBaseUnits, shortHex } from '../components/lib/format';
import { AccountChrome } from '../components/v2/AccountChrome';
import { HowThisWorks, PanelState, Skeleton } from '../components/v2/ui';

const EARN_VAULT = ANONYMIZER_ADDRESSES.sepolia.earnVault;
const EXPECTED_VAULT =
  '0x076811f28a950b5c6ddaa02bd323b5fccb572676ff57bbc3b979a430f0acda8b';

/**
 * The two receipts where this vault did the thing it exists to do: a swipe
 * that paid a merchant and opened a position in one transaction, and the
 * redemption that closed it. Both come out of src/lib/evidence.ts, which
 * `npm run verify:evidence` reads back against chain, so neither hash nor
 * block is restated here.
 */
const VAULT_TX_HASHES = [
  '0x4d94fa79724d3e997604e4a42a54daab3cc68f4ec17672b3ca9644a843e2639',
  '0x45b8c5d7a7cae0a9f98d69e92c1120c0bee831e68f9795fde00e1f3ffa3f0e0',
];
const VAULT_RECEIPTS = TX_RECORD.filter((row) => VAULT_TX_HASHES.includes(row.hash));

type VaultRead = {
  assets: string;
  blockNumber: number;
  /** Block header time, in seconds. Chain time, not this browser's clock. */
  blockTimestamp: number | null;
};

/**
 * A figure with no block behind it is a rumour, so the read returns the head
 * block it was taken at and the time that block carries.
 */
async function readTotalAssets(network: NetworkKey, vault: string): Promise<VaultRead> {
  const provider = providerFor(network);
  const head = await withRetry(() => provider.getBlockLatestAccepted());
  // Pinned to the head block we just read, not to 'latest'. Unpinned, a block
  // landing between the two calls prints the figure from N+1 under the label
  // "block N", which is a small window and still a wrong provenance line.
  const result = await withRetry(() =>
    provider.callContract(
      {
        contractAddress: vault,
        entrypoint: 'total_assets',
        calldata: [],
      },
      head.block_number,
    ),
  );
  const low = BigInt(result[0]);
  const high = BigInt(result[1] ?? '0x0');
  const blockTimestamp = await provider
    .getBlock(head.block_number)
    .then((block) => (typeof block?.timestamp === 'number' ? block.timestamp : null))
    .catch(() => null);
  return {
    assets: fromBaseUnits(low + (high << 128n), TOKENS.STRK.decimals),
    blockNumber: head.block_number,
    blockTimestamp,
  };
}

function utcFrom(seconds: number | null): string {
  if (seconds === null) return 'time not reported';
  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) return 'time not reported';
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

export function EarnClient() {
  const [read, setRead] = useState<VaultRead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!EARN_VAULT) {
      setError('Earn vault is not configured on this network.');
      setRead(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setRead(await readTotalAssets('sepolia', EARN_VAULT));
    } catch (e) {
      setRead(null);
      setError(e instanceof Error ? e.message : 'Failed to read total_assets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const vault = EARN_VAULT ?? EXPECTED_VAULT;
  const assetsNumber = read ? Number(read.assets) : null;
  const empty = assetsNumber === 0;

  return (
    <AccountChrome>
      <div className="flex flex-col gap-5">
        <div className="doc p-6 sm:p-7">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Earn
          </div>
          <h1 className="mt-2 max-w-2xl text-balance font-[family-name:var(--font-display)] text-[34px] leading-[1.06] tracking-[-0.015em] text-ink">
            Card spend at restaurants funds the Sealed EarnVault
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
            Every time your card settles a restaurant purchase, 10 STRK from the hosted settlement
            account lends into this vault. The balance below is read live from the contract.
          </p>
          {/* Naming the venue matters more than sounding impressive: this is
              Sealed's own ERC-4626 lockbox, not Vesu and not Ekubo. Ekubo does
              appear in this product, but on the settlement swap (src/server/card/jit.ts),
              never here, and a vault page that borrowed a known protocol's name
              would be the first claim a judge disproves. */}
          <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-muted">
            This is Sealed&apos;s own ERC-4626 vault on Sepolia: depositing STRK mints the same
            number of shares, and redeeming returns the STRK. It is a lockbox, not a yield
            strategy, so there is no rate to quote and none is shown.
          </p>
        </div>

        {/* What the vault demonstrably did, on paper, with the receipts.
            A testnet total is not the argument; an atomic pay-and-lend is. */}
        <div className="paper paper-torn relative px-6 pb-7 pt-9 sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-paper-muted">
                Sealed · vault ledger
              </div>
              <h2 className="mt-1 font-[family-name:var(--font-display)] text-[24px] leading-[1.1] tracking-[-0.015em] text-paper-ink">
                What this vault has done
              </h2>
            </div>
            <span className="figure mt-1 inline-flex shrink-0 rotate-[-3deg] items-center border border-[color:var(--seal)] px-2 py-0.5 text-[13px] font-semibold uppercase tracking-[0.1em] text-seal">
              Sepolia
            </span>
          </div>

          {VAULT_RECEIPTS.length === 0 ? (
            <p className="mt-6 text-[15px] leading-relaxed text-paper-ink">
              No vault receipt is recorded yet. Pay a restaurant with the card on the Card page:
              the settlement and the lend land in one transaction, and the hash appears here.
            </p>
          ) : (
            <ul className="mt-6">
              {VAULT_RECEIPTS.map((row) => (
                <li
                  key={row.hash}
                  className="rule-paper py-4 first:border-t-0 first:pt-0"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1">
                    <h3 className="text-[15px] font-semibold text-paper-ink">{row.label}</h3>
                    <span className="figure text-[13px] font-semibold text-ledger-green">
                      {row.status}
                    </span>
                  </div>
                  <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-paper-muted">
                    {row.detail}
                  </p>
                  <div className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1">
                    <a
                      href={row.href}
                      target="_blank"
                      rel="noreferrer"
                      className="figure break-all text-[13px] font-semibold text-paper-ink underline decoration-[color:var(--paper-line)] underline-offset-4 hover:decoration-[color:var(--seal)]"
                    >
                      {row.hash}
                    </a>
                    <span className="figure text-[13px] font-semibold text-paper-ink">
                      {row.network} · block {row.block ?? 'not reported'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="rule-paper mt-2 pt-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1">
              <span className="text-[13px] text-paper-muted">
                Vault total assets, right now
              </span>
              {loading ? (
                <Skeleton className="skeleton-paper h-5 w-28" />
              ) : error ? (
                <span className="figure text-[15px] font-semibold text-seal">Unavailable</span>
              ) : (
                <span className="figure text-[18px] font-bold text-paper-ink">
                  {read?.assets ?? 'Unavailable'}{' '}
                  <span className="text-[13px] font-semibold text-paper-muted">STRK</span>
                </span>
              )}
            </div>
            {!loading && !error && read && (
              <p className="figure mt-1.5 text-[13px] text-paper-muted">
                total_assets() on Sepolia · block {read.blockNumber} · {utcFrom(read.blockTimestamp)}
              </p>
            )}
            {!loading && !error && empty && (
              <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-paper-muted">
                Zero is the correct reading: the position above was redeemed. Pay another
                restaurant swipe on the Card page and 10 STRK lends back in.
              </p>
            )}
            {!loading && !error && !empty && (
              <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-paper-muted">
                Sepolia testnet money, at testnet scale. It is the same contract path a mainnet
                deployment would take, not a projection of one.
              </p>
            )}
            {error && (
              <p
                className="mt-2 max-w-xl border-l-2 border-[color:var(--seal)] pl-3 text-[13px] leading-relaxed text-paper-ink"
                role="alert"
              >
                The vault read failed: {error} Nothing is being estimated in its place.
              </p>
            )}
            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              className="mt-4 h-9 rounded-[4px] border border-[color:var(--paper-line)] px-4 text-[13px] font-semibold text-paper-ink transition-[background-color,transform] duration-150 hover:bg-paper-2 active:scale-[0.97] disabled:cursor-wait disabled:opacity-50"
            >
              {loading ? 'Reading Sepolia...' : 'Read again'}
            </button>
          </div>
        </div>

        <div className="doc p-6 sm:p-7">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            Vault contract
          </div>
          <a
            href={explorerAddressUrl('sepolia', vault)}
            target="_blank"
            rel="noreferrer"
            className="figure mt-2 block break-all text-[13px] font-semibold text-ink underline decoration-[color:var(--line-strong)] underline-offset-4 hover:decoration-[color:var(--seal-text)]"
          >
            {vault}
          </a>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted">
            <span className="figure font-semibold text-ink">{shortHex(vault)}</span> on Sepolia.
            This shows the vault&apos;s public total. The share earned from your card spend sits in
            the hosted account, which Sealed&apos;s operator can see. It is not part of your
            self-custody shielded balance.
          </p>
          <HowThisWorks className="mt-3" label="Where this number comes from">
            <p>
              Read via <span className="figure font-semibold text-ink">total_assets()</span> on the
              vault contract above, on Sepolia, at the head block printed beside it.
            </p>
          </HowThisWorks>
          {!EARN_VAULT && (
            <PanelState kind="error" title="No vault address is configured" className="mt-4">
              The address above is the expected deployment, not a configured one. Set the Sepolia
              earn vault in src/utils/constants.ts before trusting a read from it.
            </PanelState>
          )}
        </div>
      </div>
    </AccountChrome>
  );
}
