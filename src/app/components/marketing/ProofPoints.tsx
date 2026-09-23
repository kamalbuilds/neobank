import { shortenHex } from '@/lib/evidence';
import { explorerTxUrl, type NetworkKey } from '@/utils/constants';

/**
 * Real, confirmed transactions, not a demo recording. Hashes and block
 * numbers are the ones supplied as verified proof points; nothing here is
 * invented copy.
 *
 * Each row carries its own network because the two are not interchangeable:
 * the mainnet entry spends real STRK through the canonical STRK20 pool, the
 * Sepolia ones run through this project's own contracts, which exist on
 * Sepolia only. Labelling all four "Sepolia" hid the mainnet work; labelling
 * all four "mainnet" would be a lie. So the network is the first thing in the
 * row and mainnet is the louder of the two stamps.
 *
 * Drawn as a ruled ledger rather than four equal cards: this is a register of
 * receipts, and a register has rows.
 */
const PROOFS: { title: string; detail: string; tx: string; block: number; network: NetworkKey }[] = [
  {
    title: 'Shielding real STRK on mainnet',
    detail:
      'A viewing key registered and STRK shielded in the live STRK20 pool, 6 STRK of it the pool fee. Real money, not test money.',
    tx: '0x04c4bea05417ce1062adef39b3d3b300f831ec994bbb4166d6010c4838d49193',
    block: 13281484,
    network: 'mainnet',
  },
  {
    title: 'A swipe settles privately, in one transaction',
    detail:
      'A card authorization sells shielded STRK and pays the merchant in USDC. Approval and settlement are the same transaction.',
    tx: '0x1f815361cd9cb1b378f208c8def10dddf5452ead190cb199a1da37adf4fe5df',
    block: 14130415,
    network: 'sepolia',
  },
  {
    title: 'Repeat swipes don’t link to each other',
    detail:
      'A shadow spend settles through a per-merchant identity, so two visits to the same merchant don’t chain.',
    tx: '0x48ccd889292f406734d97a27c53db53910fb0f9ef3c056668bd64e20ccb111b',
    block: 14130089,
    network: 'sepolia',
  },
  {
    title: 'Money arrives already shielded',
    detail:
      'USDC bridged from Base lands and shields into the pool in the same flow. There is no separate deposit step.',
    tx: '0x28b053d9a670650604bf8f7ae8b67fc7f296d2f4fa630a987e7a6f775b11fe2',
    block: 14139603,
    network: 'sepolia',
  },
];

function NetworkStamp({ network }: { network: NetworkKey }) {
  const mainnet = network === 'mainnet';
  return (
    <span
      className={
        mainnet
          ? 'inline-flex shrink-0 items-center rounded-[3px] bg-seal px-2 py-[3px] text-[11px] font-semibold uppercase tracking-[0.1em] text-paper'
          : 'inline-flex shrink-0 items-center rounded-[3px] border border-[color:var(--line-strong)] px-2 py-[3px] text-[11px] font-semibold uppercase tracking-[0.1em] text-muted'
      }
    >
      {network}
    </span>
  );
}

export function ProofPoints() {
  return (
    <ul className="doc px-5 sm:px-6">
      {PROOFS.map((p) => (
        <li key={p.tx} className="rule first:border-t-0">
          <a
            href={explorerTxUrl(p.network, p.tx)}
            target="_blank"
            rel="noreferrer"
            className="group grid gap-x-8 gap-y-3 py-6 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-baseline"
          >
            <NetworkStamp network={p.network} />
            <div className="min-w-0">
              <h3 className="text-[17px] font-medium leading-snug text-ink">{p.title}</h3>
              <p className="mt-2 max-w-[58ch] text-[13px] leading-relaxed text-muted">{p.detail}</p>
            </div>
            <div className="figure text-[13px] sm:text-right">
              <span className="block text-ink underline decoration-[color:var(--line-strong)] underline-offset-4 transition-colors duration-150 group-hover:decoration-[color:var(--ink)]">
                {shortenHex(p.tx)}
              </span>
              <span className="mt-1 block text-muted">block {p.block.toLocaleString('en-US')}</span>
              <span className="mt-1 block text-muted">Voyager</span>
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}
