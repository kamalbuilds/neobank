import { providerFor, STRK20_POOL_ADDRESS, type NetworkKey } from "@/utils/constants";

// keccak("Deposit") selector on the STRK20 pool. keys[1] is the depositor -
// the only address this event proves initiated the deposit. Never read
// tx.sender for this: a relayer can submit on the depositor's behalf.
const DEPOSIT_SELECTOR = "0x01321a492485b4f19851fb787ab3800a0030b595332cba93cd5fe40dfb5a4daf";

// Companion event in the same transaction carrying the token (keys[2]) and
// amount (data[0]) legs of the deposit. It does not itself carry a reliable
// depositor key, so it is only ever read via the receipt of a tx already
// matched through DEPOSIT_SELECTOR above.
const TOKEN_SELECTOR = "0x09149d2123147c5f43d258257fef0b7b969db78269369ebcf5ebb9eef8592f2";

const PAGE_SIZE = 1000;
const MAX_PAGES = 50; // safety valve against a misbehaving RPC looping continuation_token forever

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

  const depositEvents: { transactionHash: string; block: number }[] = [];
  let continuationToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const chunk = await provider.getEvents({
      address: STRK20_POOL_ADDRESS,
      keys: [[DEPOSIT_SELECTOR]],
      from_block: { block_number: 0 },
      to_block: "latest",
      chunk_size: PAGE_SIZE,
      continuation_token: continuationToken,
    } as Parameters<typeof provider.getEvents>[0]);

    for (const event of chunk.events) {
      const depositor = event.keys?.[1];
      if (depositor && sameAddress(depositor, address)) {
        depositEvents.push({ transactionHash: event.transaction_hash, block: event.block_number ?? 0 });
      }
    }

    continuationToken = chunk.continuation_token;
    if (!continuationToken) break;
  }

  const entries: PoolActivityEntry[] = [];
  for (const dep of depositEvents) {
    const entry: PoolActivityEntry = { kind: "deposit", txHash: dep.transactionHash, block: dep.block };
    try {
      const receipt: any = await provider.getTransactionReceipt(dep.transactionHash);
      const events: any[] = receipt?.value?.events ?? receipt?.events ?? [];
      const tokenEvent = events.find(
        (e) => sameAddress(e.from_address, STRK20_POOL_ADDRESS) && e.keys?.[0] && sameAddress(e.keys[0], TOKEN_SELECTOR)
      );
      if (tokenEvent) {
        entry.token = tokenEvent.keys[2];
        entry.amount = BigInt(tokenEvent.data[0]);
      }
    } catch {
      // Token leg is best-effort enrichment - the deposit itself is already
      // proven by the matched event, so a receipt-read failure only means
      // this row shows without amount/token, not that it gets dropped.
    }
    entries.push(entry);
  }

  entries.sort((a, b) => b.block - a.block);
  return entries;
}
