'use client';

import { useCallback, useEffect, useState } from 'react';
import { providerFor } from '@/utils/constants';
import { withRetry } from '../lib/rpcRetry';
import { Skeleton } from '../v2/ui';

/**
 * The rest of this page is a static record: hashes that settled weeks ago and
 * counts derived at build time. All of it is true and none of it moves, so a
 * reader has no way to tell the site apart from a screenshot of one. This is
 * the one figure that has to be read now, from the network the page claims to
 * be live on.
 *
 * Mainnet, deliberately: the headline above says Sealed is live on Starknet
 * mainnet through the STRK20 pool, so mainnet is the chain whose liveness this
 * has to demonstrate. The card, vault and bridge loops run on Sepolia and say
 * so in their own rows.
 */
const NETWORK_LABEL = 'Starknet mainnet';

/** Chain head blocks arrive about every half minute, so re-read on that cadence. */
const REFRESH_MS = 30_000;

type Head = { blockNumber: number; readAt: Date };

function clockUtc(at: Date): string {
  return `${at.toISOString().slice(11, 19)} UTC`;
}

export function ChainHead() {
  const [head, setHead] = useState<Head | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [reading, setReading] = useState(true);

  const read = useCallback(async () => {
    setReading(true);
    try {
      const block = await withRetry(() => providerFor('mainnet').getBlockLatestAccepted());
      setHead({ blockNumber: block.block_number, readAt: new Date() });
      setFailure(null);
    } catch (e) {
      // The previously read block is kept on screen rather than blanked,
      // because the caption under it names the time that block was read and so
      // never claims to be current. What is not allowed is the opposite: a
      // number that silently stops updating with a caption that says "now".
      setFailure(e instanceof Error ? e.message : 'the node did not answer');
    } finally {
      setReading(false);
    }
  }, []);

  useEffect(() => {
    void read();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void read();
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [read]);

  return (
    <div className="rule mt-10 grid gap-x-10 gap-y-4 pt-8 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:items-baseline">
      <div>
        {head === null ? (
          reading ? (
            <div
              className="flex flex-col gap-3"
              role="status"
              aria-busy="true"
              aria-label={`Reading the ${NETWORK_LABEL} chain head`}
            >
              <Skeleton className="h-[44px] w-44" />
            </div>
          ) : (
            <p className="figure text-[24px] font-semibold leading-none text-seal-bright">
              Unavailable
            </p>
          )
        ) : (
          <p className="figure text-[44px] font-semibold leading-none tracking-[-0.03em] text-ink">
            {head.blockNumber.toLocaleString('en-US')}
          </p>
        )}
        <p className="mt-3 text-[15px] leading-snug text-ink">
          {NETWORK_LABEL} head block
        </p>
      </div>

      <div>
        {head === null && !reading && failure ? (
          <p className="text-[13px] leading-relaxed text-muted" role="alert">
            The {NETWORK_LABEL} node did not answer, so no block number is shown: {failure}. Nothing
            is being estimated in its place. The counts above are read from the repository and are
            unaffected.
          </p>
        ) : (
          <p className="text-[13px] leading-relaxed text-muted">
            {head === null
              ? `Reading the ${NETWORK_LABEL} head from the RPC this app uses for every mainnet call.`
              : `Read from ${NETWORK_LABEL} at ${clockUtc(head.readAt)}, by this browser, over the same RPC every mainnet call on this site uses. Re-read every 30 seconds while this tab is open.`}
          </p>
        )}
        {head !== null && failure ? (
          <p className="mt-2 text-[13px] leading-relaxed text-seal-bright" role="alert">
            The most recent re-read failed: {failure}. The block above is the last one that
            answered, at the time printed beside it, not the head right now.
          </p>
        ) : null}
      </div>
    </div>
  );
}
