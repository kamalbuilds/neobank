import type { Metadata } from 'next';
import Link from 'next/link';
import { ContractsFooter } from './components/marketing/ContractsFooter';
import { EvidenceStamp } from './components/marketing/EvidenceStamp';
import { ProofPoints } from './components/marketing/ProofPoints';
import { RedactedStatement } from './components/marketing/RedactedStatement';
import { TestnetNotice } from './components/marketing/TestnetNotice';
import { ThreatModelTable } from './components/marketing/ThreatModelTable';

export const metadata: Metadata = {
  title: 'Sealed: a private money account on Starknet',
  description:
    'Hold, spend, and move money without publishing your balance to a public ledger. Live on Starknet mainnet through the STRK20 pool; the card, vault and bridge loops run on Sepolia.',
};

/**
 * The four routes, drawn as a ruled ledger rather than four equal cards with
 * arrow glyphs. The route itself is the affordance: a reader who wants to know
 * where a line goes can read the path.
 */
const USES = [
  {
    index: '01',
    label: 'Hold',
    href: '/app',
    title: 'Deposit stays yours to see',
    body: 'Bring in USDC or STRK. Your balance shows on your screen, not on a public explorer.',
  },
  {
    index: '02',
    label: 'Spend',
    href: '/spend',
    title: 'A card that settles privately',
    body: 'Swipe and it approves instantly. The merchant sees a card number, never your balance or your other activity.',
  },
  {
    index: '03',
    label: 'Earn',
    href: '/earn',
    title: 'Put idle balance to work',
    body: 'Restaurant swipes lend into a vault automatically. Total assets are read live from the contract, not a projection.',
  },
  {
    index: '04',
    label: 'Fund',
    href: '/fund',
    title: 'Bridge in already shielded',
    body: 'Bring USDC in from Base and it lands shielded. No separate deposit step, no exposed transfer.',
  },
] as const;

const PRIVACY_DOCS = [
  { href: '/docs/privacy/who-sees-what', label: 'Who sees what, party by party' },
  { href: '/docs/privacy/the-hosted-account', label: 'The custodial exception' },
  { href: '/docs/privacy/refused-claims', label: 'What we refuse to claim' },
] as const;

export default function LandingPage() {
  return (
    <div className="vault-bg min-h-[100dvh]">
      <TestnetNotice />

      <header className="mx-auto max-w-[1100px] px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
          <span className="font-[family-name:var(--font-display)] text-[24px] leading-none tracking-[-0.02em] text-ink">
            Sealed<span className="text-muted">.cash</span>
          </span>
          <nav className="order-3 flex w-full items-center gap-6 text-[15px] text-muted sm:order-2 sm:w-auto">
            <a href="#privacy" className="transition-colors duration-150 hover:text-ink">
              How privacy works
            </a>
            <a href="#proof" className="transition-colors duration-150 hover:text-ink">
              Proof
            </a>
            <Link href="/docs" className="transition-colors duration-150 hover:text-ink">
              Docs
            </Link>
          </nav>
          <Link
            href="/app"
            className="order-2 rounded-[4px] bg-paper px-4 py-2 text-[15px] font-medium text-paper-ink transition-[background-color,transform] duration-150 hover:bg-paper-2 active:scale-[0.97] sm:order-3"
          >
            Open your account
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-[1100px] px-6 pb-16 pt-8 lg:pb-24 lg:pt-14">
        <div className="grid items-start gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16">
          <div>
            <h1 className="text-balance font-[family-name:var(--font-display)] text-[clamp(2.5rem,5.4vw,3.75rem)] font-normal leading-[1.04] tracking-[-0.03em] text-ink">
              A money account the public ledger can&apos;t read.
            </h1>
            <p className="mt-6 max-w-xl text-pretty text-[17px] leading-relaxed text-ink">
              Hold, spend and send on Starknet. Everyone can see that you have an account. No one
              can see what is in it.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/app"
                className="rounded-[4px] bg-paper px-6 py-3.5 text-[15px] font-medium text-paper-ink transition-[background-color,transform] duration-150 hover:bg-paper-2 active:scale-[0.97]"
              >
                Open your account
              </Link>
              <Link
                href="/docs"
                className="doc doc-interactive px-6 py-3.5 text-[15px] font-medium text-ink"
              >
                Read the docs
              </Link>
            </div>
            <p className="mt-8 max-w-md text-[13px] leading-relaxed text-muted">
              Live on Starknet mainnet for holding and shielding, through the canonical STRK20 pool.
              The card, vault and bridge loops run on Sepolia, where this project&apos;s own
              contracts are deployed. Not a licensed bank. Not a mixer.
            </p>
          </div>

          <div className="mx-auto w-full max-w-[460px] lg:mx-0 lg:max-w-none">
            <RedactedStatement />
          </div>
        </div>

        <EvidenceStamp />
      </section>

      <section className="mx-auto max-w-[1100px] px-6 py-16">
        <h2 className="font-[family-name:var(--font-display)] text-[24px] leading-tight tracking-[-0.02em] text-ink">
          What the account does
        </h2>
        <ol className="mt-6">
          {USES.map((u) => (
            <li key={u.label} className="rule">
              <Link
                href={u.href}
                className="group grid gap-x-8 gap-y-2 py-6 sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:items-baseline"
              >
                <span className="figure text-[13px] font-semibold text-muted">{u.index}</span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-baseline gap-x-3">
                    <span className="font-[family-name:var(--font-display)] text-[24px] leading-none tracking-[-0.02em] text-ink">
                      {u.label}
                    </span>
                    <span className="text-[17px] leading-snug text-ink">{u.title}</span>
                  </span>
                  <span className="mt-2 block max-w-[62ch] text-[13px] leading-relaxed text-muted">
                    {u.body}
                  </span>
                </span>
                <span className="figure text-[13px] text-muted underline decoration-[color:var(--line-strong)] underline-offset-4 transition-colors duration-150 group-hover:text-ink group-hover:decoration-[color:var(--ink)] sm:text-right">
                  {u.href}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section id="privacy" className="mx-auto max-w-[1100px] px-6 py-16">
        <div className="rule grid gap-4 pb-8 pt-8 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)]">
          <h2 className="font-[family-name:var(--font-display)] text-[24px] leading-tight tracking-[-0.02em] text-ink">
            What&apos;s hidden, what isn&apos;t
          </h2>
          <p className="max-w-[62ch] text-[15px] leading-relaxed text-muted">
            A privacy pool on a public blockchain is not invisible. It is selectively decryptable.
            Here is exactly what that means, fact by fact, not a marketing promise.
          </p>
        </div>

        <div className="mt-2">
          <ThreatModelTable />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {PRIVACY_DOCS.map((d) => (
            <Link
              key={d.href}
              href={d.href}
              className="doc doc-interactive px-4 py-2.5 text-[15px] font-medium text-ink"
            >
              {d.label}
            </Link>
          ))}
        </div>

        <div className="doc mt-8 max-w-3xl p-6 text-[15px] leading-relaxed text-muted">
          <p className="font-medium text-ink">
            Who holds the key that unlocks the revealed column?
          </p>
          <p className="mt-2">
            Your personal wallet generates and holds your viewing key on your own device the first
            time you shield with it. Sealed&apos;s app code never receives or stores it. The one
            exception is the hosted card-settlement account used to process swipes: it has its own
            separate, server-held viewing key so it can operate that one account. It cannot decrypt
            your personal wallet&apos;s notes.
          </p>
          <p className="mt-5 font-medium text-ink">Why does it have to be Ready?</p>
          <p className="mt-2">
            Private actions need a wallet that implements the Starknet privacy wallet API, the part
            that generates your viewing key on-device and produces the proofs behind every private
            transfer. Ready is the wallet that does this today. Other Starknet wallets can still
            hold your public funds; they just can&apos;t do the private actions yet.
          </p>
        </div>
      </section>

      <section id="proof" className="mx-auto max-w-[1100px] px-6 py-16">
        <h2 className="font-[family-name:var(--font-display)] text-[24px] leading-tight tracking-[-0.02em] text-ink">
          Not a demo recording. Four receipts you can open.
        </h2>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
          Four of the transactions on the record: one on mainnet against the live STRK20 pool,
          three on Sepolia through this project&apos;s own contracts. Each is confirmed on chain,
          so click through to Voyager and read it yourself.
        </p>
        <div className="mt-8">
          <ProofPoints />
        </div>
        <Link
          href="/docs/evidence"
          className="mt-6 inline-block text-[15px] text-ink underline decoration-[color:var(--line-strong)] underline-offset-4 transition-colors duration-150 hover:decoration-[color:var(--ink)]"
        >
          Every contract and transaction, with the file each value comes from
        </Link>
      </section>

      <ContractsFooter />
    </div>
  );
}
