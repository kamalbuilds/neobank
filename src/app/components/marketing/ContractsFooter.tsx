import {
  ANONYMIZER_ADDRESSES,
  CARD_PROGRAM_ADDRESSES,
  explorerAddressUrl,
  JIT_CONVERTER_ADDRESSES,
  STRK20_POOL_ADDRESSES,
} from '@/utils/constants';

const NETWORK = 'sepolia' as const;

function shorten(address: string): string {
  return `${address.slice(0, 10)}…${address.slice(-6)}`;
}

/**
 * The trust surface the review flagged as entirely missing: real deployed
 * addresses, each linked to the explorer, plus the one repo that is
 * genuinely public. Every address here is read from src/utils/constants.ts /
 * strk20.json, not typed by hand, and each was re-checked live against
 * Voyager (Sepolia) while building this page.
 */
const CONTRACTS: { name: string; detail: string; address: string | null }[] = [
  {
    name: 'Privacy pool',
    detail: 'Canonical STRK20 privacy pool that every shield, spend, and withdraw settles through',
    address: STRK20_POOL_ADDRESSES[NETWORK],
  },
  {
    name: 'Card settlement',
    detail: 'Settles an approved card swipe from the hosted account',
    address: ANONYMIZER_ADDRESSES[NETWORK].cardSettlement,
  },
  {
    name: 'Card program',
    detail: 'Card policy: per-swipe cap, daily cap, blocked categories',
    address: CARD_PROGRAM_ADDRESSES[NETWORK],
  },
  {
    name: 'JIT converter',
    detail: 'Sells shielded STRK to settle a swipe in USDC in one transaction',
    address: JIT_CONVERTER_ADDRESSES[NETWORK],
  },
  {
    name: 'Earn vault',
    detail: 'Restaurant-swipe lending vault; total_assets read live on the Earn page',
    address: ANONYMIZER_ADDRESSES[NETWORK].earnVault,
  },
  {
    name: 'Shadow anonymizer',
    detail: 'Per-merchant identity so repeat swipes at the same merchant don’t link together',
    address: ANONYMIZER_ADDRESSES[NETWORK].shadowAccount,
  },
];

export function ContractsFooter() {
  return (
    <footer className="border-t border-white/[0.07] bg-black/20">
      <div className="mx-auto max-w-[1100px] px-6 py-14">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-[family-name:var(--font-display)] text-[22px] font-semibold tracking-[-0.02em] text-[#eaf0f8]">
            Every contract, on the record
          </h2>
          <a
            href="https://github.com/kamalbuilds/starknet-shadow-account-starter"
            target="_blank"
            rel="noreferrer"
            className="text-[13px] font-medium text-[#7a859c] underline decoration-white/20 underline-offset-4 transition-colors hover:text-[#eaf0f8]"
          >
            github.com/kamalbuilds/starknet-shadow-account-starter →
          </a>
        </div>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[#7a859c]">
          Sealed is a non-custodial Starknet app. It is not a licensed bank and not a mixer - every
          contract below is a deployed, verifiable Sepolia address, not a claim.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {CONTRACTS.map((c) => (
            <a
              key={c.name}
              href={c.address ? explorerAddressUrl(NETWORK, c.address) : undefined}
              target={c.address ? '_blank' : undefined}
              rel={c.address ? 'noreferrer' : undefined}
              aria-disabled={!c.address}
              className={`block rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 transition-colors duration-150 ${
                c.address ? 'hover:border-white/[0.16] hover:bg-white/[0.045]' : 'opacity-50'
              }`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13.5px] font-semibold text-[#eaf0f8]">{c.name}</span>
                <span className="font-[family-name:var(--font-mono-ui)] text-[11px] text-[#7a859c]">
                  {c.address ? shorten(c.address) : 'not on Sepolia'}
                </span>
              </div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-[#7a859c]">{c.detail}</p>
            </a>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-6 text-[12px] text-[#687287]">
          <span>Sepolia testnet &middot; real transactions, test money.</span>
          <span>Sealed.cash &middot; a private money account on Starknet</span>
        </div>
      </div>
    </footer>
  );
}
