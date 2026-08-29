import { explorerTxUrl } from '@/utils/constants';

const NETWORK = 'sepolia' as const;

/**
 * Three real, confirmed Sepolia transactions - not a demo recording. Hashes
 * and block numbers are the ones supplied as verified proof points; nothing
 * here is invented copy.
 */
const PROOFS: { title: string; detail: string; tx: string; block: number }[] = [
  {
    title: 'A swipe settles privately, in one transaction',
    detail:
      'A card authorization sells shielded STRK and pays the merchant in USDC - approval and settlement, one Sepolia transaction.',
    tx: '0x1f815361cd9cb1b378f208c8def10dddf5452ead190cb199a1da37adf4fe5df',
    block: 14130415,
  },
  {
    title: 'Repeat swipes don’t link to each other',
    detail: 'A shadow spend settles through a per-merchant identity, so two visits to the same merchant don’t chain.',
    tx: '0x48ccd889292f406734d97a27c53db53910fb0f9ef3c056668bd64e20ccb111b',
    block: 14130089,
  },
  {
    title: 'Money arrives already shielded',
    detail: 'USDC bridged from Base lands and shields into the pool in the same flow - no separate deposit step.',
    tx: '0x28b053d9a670650604bf8f7ae8b67fc7f296d2f4fa630a987e7a6f775b11fe2',
    block: 14139603,
  },
];

export function ProofPoints() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {PROOFS.map((p) => (
        <a
          key={p.tx}
          href={explorerTxUrl(NETWORK, p.tx)}
          target="_blank"
          rel="noreferrer"
          className="group flex flex-col rounded-2xl border border-white/[0.07] bg-white/[0.022] p-5 transition-colors duration-150 hover:border-white/[0.16] hover:bg-white/[0.04]"
        >
          <h3 className="text-[14.5px] font-semibold leading-snug text-[#eaf0f8]">{p.title}</h3>
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
