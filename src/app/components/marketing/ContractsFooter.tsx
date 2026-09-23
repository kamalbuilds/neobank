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
 * addresses, each linked to the explorer, plus the repos that are genuinely
 * public. Every address here is read from src/utils/constants.ts /
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

/**
 * Two repos, named apart. The app and its evidence record live in neobank,
 * which is what /docs/evidence cites; the Cairo starter the anonymizers were
 * built from is a separate repository, and sending a reviewer to the starter
 * when they asked for the source was the bug here.
 */
const REPOS: { label: string; detail: string; href: string }[] = [
  {
    label: 'kamalbuilds/neobank',
    detail: 'This app, the evidence record, and the scripts that verify it',
    href: 'https://github.com/kamalbuilds/neobank',
  },
  {
    label: 'kamalbuilds/starknet-shadow-account-starter',
    detail: 'The Cairo anonymizer starter the contracts above were built from',
    href: 'https://github.com/kamalbuilds/starknet-shadow-account-starter',
  },
];

export function ContractsFooter() {
  return (
    <footer className="rule bg-chrome-2">
      <div className="mx-auto max-w-[1100px] px-6 py-16">
        <h2 className="font-[family-name:var(--font-display)] text-[24px] leading-tight tracking-[-0.02em] text-ink">
          Every contract, on the record
        </h2>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
          Sealed is a non-custodial Starknet app. It is not a licensed bank and not a mixer. Every
          contract below is a deployed, verifiable Sepolia address, not a claim.
        </p>

        <ul className="mt-8">
          {CONTRACTS.map((c) => (
            <li key={c.name} className="rule first:border-t-0">
              {c.address ? (
                <a
                  href={explorerAddressUrl(NETWORK, c.address)}
                  target="_blank"
                  rel="noreferrer"
                  className="group grid gap-x-8 gap-y-2 py-5 sm:grid-cols-[11rem_minmax(0,1fr)_auto] sm:items-baseline"
                >
                  <span className="text-[15px] font-medium text-ink">{c.name}</span>
                  <span className="text-[13px] leading-relaxed text-muted">{c.detail}</span>
                  <span className="figure text-[13px] text-ink underline decoration-[color:var(--line-strong)] underline-offset-4 transition-colors duration-150 group-hover:decoration-[color:var(--ink)] sm:text-right">
                    {shorten(c.address)}
                  </span>
                </a>
              ) : (
                <div className="grid gap-x-8 gap-y-2 py-5 sm:grid-cols-[11rem_minmax(0,1fr)_auto] sm:items-baseline">
                  <span className="text-[15px] font-medium text-ink">{c.name}</span>
                  <span className="text-[13px] leading-relaxed text-muted">{c.detail}</span>
                  <span className="figure text-[13px] text-muted sm:text-right">
                    not on Sepolia
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>

        <ul className="mt-10">
          {REPOS.map((r) => (
            <li key={r.href} className="rule">
              <a
                href={r.href}
                target="_blank"
                rel="noreferrer"
                className="group grid gap-x-8 gap-y-2 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline"
              >
                <span className="figure text-[15px] text-ink underline decoration-[color:var(--line-strong)] underline-offset-4 transition-colors duration-150 group-hover:decoration-[color:var(--ink)]">
                  {r.label}
                </span>
                <span className="text-[13px] leading-relaxed text-muted sm:text-right">
                  {r.detail}
                </span>
              </a>
            </li>
          ))}
        </ul>

        <div className="rule mt-10 flex flex-wrap items-center justify-between gap-4 pt-6 text-[13px] leading-relaxed text-muted">
          <span className="max-w-xl">
            Contracts above are Sepolia, test money. Holding and shielding are live on mainnet
            through the STRK20 pool.
          </span>
          <span>Sealed.cash, a private money account on Starknet</span>
        </div>
      </div>
    </footer>
  );
}
