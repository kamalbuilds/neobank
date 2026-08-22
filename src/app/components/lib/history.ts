import { providerFor, poolAddressFor, type NetworkKey } from "@/utils/constants";

// starknet_keccak("Deposit") on the STRK20 pool, checked with
// hash.getSelectorFromName. The event is Deposit{user_addr(key), token(key),
// amount(data)}, so keys[1] is the depositor, keys[2] the token and data[0]
// the amount - every leg on one event, no receipt round-trip needed.
//
// Never read tx.sender here: private transactions are relayed, so the sender
// is the relayer for every user.
//
// This constant previously held starknet_keccak("ViewingKeySet"), which is
// emitted once per account at registration. Filtering on it showed a single
// activity row no matter how many deposits a user made, and hid any shield
// that was not the account's first.
const DEPOSIT_SELECTOR = "0x9149d2123147c5f43d258257fef0b7b969db78269369ebcf5ebb9eef8592f2";

// Asking from block 0 does not return nothing-then-results: the RPC pages by
// block window, so every page before the pool existed comes back empty but
// still carries a continuation token. Measured against mainnet, twelve
// consecutive pages from block 0 were all empty, so a page budget is spent long
// before any deposit is reached and the panel shows nothing for everybody.
// Start where each pool starts.
//
// Mainnet's first Deposit is in block 9,023,083. The Sepolia pool contract was
// created in Sepolia block 8,271,125, which is that chain's own numbering and
// not comparable to mainnet's.
const POOL_FIRST_BLOCK: Record<NetworkKey, number> = {
  mainnet: 9_000_000,
  sepolia: 8_200_000,
};

const PAGE_SIZE = 1000;
// The pool's life is split into this many block windows, scanned concurrently.
const WINDOWS = 8;
// Per window, a safety valve against an RPC looping continuation_token forever.
const MAX_PAGES_PER_WINDOW = 40;

export interface PoolActivityEntry {
  kind: "deposit";
  token?: string;
  amount?: bigint;
  txHash: string;
  block: number;
}

function sameAddress(a: string, b: string): boolean {
  try {
    return BigInt(a) === BigInt(b);
  } catch {
    return false;
  }
}

// Public deposit/withdraw legs only - never private transfer amounts or
// counterparties. Filters on the event's own depositor key (topic1), never
// on the transaction's tx.sender, which can be a relayer.
export async function getPoolActivity(network: NetworkKey, address: string): Promise<PoolActivityEntry[]> {
  const provider = providerFor(network);

  const latest = await provider.getBlockNumber();
  const first = Math.min(POOL_FIRST_BLOCK[network], latest);
  const span = Math.max(1, Math.ceil((latest - first + 1) / WINDOWS));

  // One scan per block window, run concurrently. Walking the pool's whole life
  // in a single paged loop took 58 sequential round trips and about 86 seconds
  // against mainnet, because a page is a block window rather than PAGE_SIZE
  // matches. Splitting the range turns that wait into roughly one window's
  // worth. Each window paginates independently and owns its own page budget.
  const windows = Array.from({ length: WINDOWS }, (_, i) => {
    const from = first + i * span;
    return { from, to: Math.min(latest, from + span - 1) };
  }).filter((w) => w.from <= latest);

  const perWindow = await Promise.all(
    windows.map(async ({ from, to }) => {
      const found: PoolActivityEntry[] = [];
      let continuationToken: string | undefined;

      for (let page = 0; page < MAX_PAGES_PER_WINDOW; page++) {
        const chunk = await provider.getEvents({
          address: poolAddressFor(network),
          // Second key is the depositor, so the node filters for us. Padded and
          // unpadded forms both match: the RPC normalises felts. The client-side
          // check below stays as defence, not as the primary filter.
          keys: [[DEPOSIT_SELECTOR], [address]],
          from_block: { block_number: from },
          to_block: { block_number: to },
          chunk_size: PAGE_SIZE,
          continuation_token: continuationToken,
        } as Parameters<typeof provider.getEvents>[0]);

        for (const event of chunk.events) {
          const depositor = event.keys?.[1];
          if (!depositor || !sameAddress(depositor, address)) continue;

          const entry: PoolActivityEntry = {
            kind: "deposit",
            txHash: event.transaction_hash,
            block: event.block_number ?? 0,
          };
          // Token and amount ride on this same event. A malformed one still
          // lists as a deposit, because the matched depositor key proves it.
          if (event.keys?.[2]) entry.token = event.keys[2];
          try {
            if (event.data?.[0] !== undefined) entry.amount = BigInt(event.data[0]);
          } catch {
            // Leave amount unset rather than dropping a proven deposit.
          }
          found.push(entry);
        }

        continuationToken = chunk.continuation_token;
        if (!continuationToken) break;
      }

      return found;
    }),
  );

  const entries = perWindow.flat();
  entries.sort((a, b) => b.block - a.block);
  return entries;
}
