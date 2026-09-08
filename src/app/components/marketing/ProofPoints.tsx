import { explorerTxUrl, type NetworkKey } from '@/utils/constants';

/**
 * Real, confirmed transactions - not a demo recording. Hashes and block
 * numbers are the ones supplied as verified proof points; nothing here is
 * invented copy.
 *
 * Each card carries its own network because the two are not interchangeable:
 * the mainnet entry spends real STRK through the canonical STRK20 pool, the
 * Sepolia ones run through this project's own contracts, which exist on
 * Sepolia only. Labelling all four "Sepolia" hid the mainnet work; labelling
 * all four "mainnet" would be a lie.
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
      'A card authorization sells shielded STRK and pays the merchant in USDC - approval and settlement, one transaction.',
    tx: '0x1f815361cd9cb1b378f208c8def10dddf5452ead190cb199a1da37adf4fe5df',
    block: 14130415,
    network: 'sepolia',
  },
  {
    title: 'Repeat swipes don’t link to each other',
    detail: 'A shadow spend settles through a per-merchant identity, so two visits to the same merchant don’t chain.',
    tx: '0x48ccd889292f406734d97a27c53db53910fb0f9ef3c056668bd64e20ccb111b',
    block: 14130089,
    network: 'sepolia',
  },
  {
    title: 'Money arrives already shielded',
    detail: 'USDC bridged from Base lands and shields into the pool in the same flow - no separate deposit step.',
    tx: '0x28b053d9a670650604bf8f7ae8b67fc7f296d2f4fa630a987e7a6f775b11fe2',
    block: 14139603,
    network: 'sepolia',
  },
];

export function ProofPoints() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {PROOFS.map((p) => (
        <a
          key={p.tx}
          href={explorerTxUrl(p.network, p.tx)}
          target="_blank"
          rel="noreferrer"
          className="group flex flex-col rounded-2xl border border-white/[0.07] bg-white/[0.022] p-5 transition-colors duration-150 hover:border-white/[0.16] hover:bg-white/[0.04]"
        >
          <span
            className={`self-start rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
              p.network === 'mainnet'
                ? 'bg-[#2dd4bf]/[0.14] text-[#6ee9d5]'
                : 'bg-white/[0.05] text-[#7a859c]'
            }`}
          >
            {p.network}
          </span>
          <h3 className="mt-3 text-[14.5px] font-semibold leading-snug text-[#eaf0f8]">{p.title}</h3>
          <p className="mt-2 flex-1 text-[12.5px] leading-relaxed text-[#7a859c]">{p.detail}</p>
          <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3">
            <span className="font-[family-name:var(--font-mono-ui)] text-[11px] text-[#687287]">
              block {p.block.toLocaleString()}
            </span>
            <span className="text-[11.5px] font-medium text-[#6ee9d5] group-hover:text-[#93f5e0]">
              View on Voyager →
            </span>
          </div>
        </a>
      ))}
    </div>
  );
}
