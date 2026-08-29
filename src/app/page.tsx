import type { Metadata } from 'next';
import Link from 'next/link';
import { BankCard } from './components/v2/BankCard';
import { ThreatModelTable } from './components/marketing/ThreatModelTable';
import { ProofPoints } from './components/marketing/ProofPoints';
import { ContractsFooter } from './components/marketing/ContractsFooter';
import { TestnetNotice } from './components/marketing/TestnetNotice';

export const metadata: Metadata = {
  title: 'Sealed: a private money account on Starknet',
  description:
    'Hold, spend, and move money without publishing your balance to a public ledger. Sepolia testnet today, real transactions, test money.',
};

const USES = [
  {
    label: 'Hold',
    href: '/app',
    title: 'Deposit stays yours to see',
    body: 'Bring in USDC or STRK. Your balance shows on your screen, not on a public explorer.',
  },
  {
    label: 'Spend',
    href: '/spend',
    title: 'A card that settles privately',
    body: 'Swipe and it approves instantly. The merchant sees a card number - never your balance or your other activity.',
  },
  {
    label: 'Earn',
    href: '/earn',
    title: 'Put idle balance to work',
    body: 'Restaurant swipes lend into a vault automatically. Total assets are read live from the contract, not a projection.',
  },
  {
    label: 'Fund',
    href: '/fund',
    title: 'Bridge in already shielded',
    body: 'Bring USDC in from Base and it lands shielded - no separate deposit step, no exposed transfer.',
  },
] as const;

export default function LandingPage() {
  return (
    <div className="vault-bg min-h-[100dvh] text-[#eaf0f8]">
      <TestnetNotice />

      <header className="mx-auto flex max-w-[1100px] items-center justify-between px-6 py-5">
        <span className="font-[family-name:var(--font-display)] text-[16px] font-semibold tracking-[-0.01em]">
          <span className="bg-gradient-to-r from-[#2dd4bf] via-[#38bdf8] to-[#818cf8] bg-clip-text text-transparent">
            Sealed
          </span>
          <span className="text-[#6b7689]">.cash</span>
        </span>
        <nav className="flex items-center gap-5 text-[13.5px] font-medium text-[#a3acbd]">
          <a href="#privacy" className="hidden transition-colors hover:text-[#eaf0f8] sm:inline">
            How privacy works
          </a>
          <a href="#proof" className="hidden transition-colors hover:text-[#eaf0f8] sm:inline">
            Proof
          </a>
          <Link href="/docs" className="transition-colors hover:text-[#eaf0f8]">
            Docs
          </Link>
          <Link
            href="/app"
            className="rounded-full bg-gradient-to-br from-[#2dd4bf] to-[#38bdf8] px-4 py-2 text-[13px] font-semibold text-[#04140f] shadow-[0_4px_16px_-6px_rgba(45,212,191,0.5)] transition-transform duration-150 active:scale-[0.97]"
          >
            Open your account
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-[1100px] items-center gap-10 px-6 pb-16 pt-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14 lg:pb-24 lg:pt-16">
        <div>
          <h1 className="text-balance font-[family-name:var(--font-display)] text-[clamp(2.25rem,5vw,3.75rem)] font-medium leading-[1.04] tracking-[-0.03em]">
            A money account the public ledger can&apos;t read.
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-[16px] leading-relaxed text-[#a3acbd]">
            Deposit USDC or STRK, spend with a card, send to anyone on Starknet. Everyone can see
            that you have an account. No one can see what&apos;s in it, unless you choose to show
            them.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/app"
              className="rounded-2xl bg-gradient-to-br from-[#2dd4bf] to-[#38bdf8] px-6 py-3.5 text-[14.5px] font-semibold text-[#04140f] shadow-[0_10px_30px_-12px_rgba(45,212,191,0.55)] transition-transform duration-150 active:scale-[0.97]"
            >
              Open your account
            </Link>
            <Link
              href="/docs"
              className="rounded-2xl border border-white/[0.12] bg-white/[0.03] px-6 py-3.5 text-[14.5px] font-medium text-[#d8deea] transition-colors duration-150 hover:border-white/[0.2] hover:bg-white/[0.06]"
            >
              Read the docs
            </Link>
          </div>
          <p className="mt-5 max-w-md text-[12.5px] leading-relaxed text-[#687287]">
            Sepolia testnet &middot; real transactions, test money. Not a licensed bank. Not a
            mixer.
          </p>
        </div>

        <div className="mx-auto w-full max-w-[420px] lg:mx-0">
          <BankCard network="Sepolia" status="ready" dailyCap="100 STRK" />
        </div>
      </section>

      {/* What you can do */}
      <section className="mx-auto max-w-[1100px] px-6 py-14">
        <h2 className="font-[family-name:var(--font-display)] text-[22px] font-semibold tracking-[-0.02em]">
          What you can do here
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {USES.map((u) => (
            <Link
              key={u.label}
              href={u.href}
              className="group flex flex-col rounded-2xl border border-white/[0.07] bg-white/[0.022] p-5 transition-colors duration-150 hover:border-white/[0.16] hover:bg-white/[0.04]"
            >
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#6ee9d5]">
                {u.label}
              </span>
              <h3 className="mt-2 text-[15px] font-semibold leading-snug text-[#eaf0f8]">{u.title}</h3>
              <p className="mt-2 flex-1 text-[12.5px] leading-relaxed text-[#7a859c]">{u.body}</p>
              <span className="mt-4 text-[11.5px] font-medium text-[#a3acbd] group-hover:text-[#eaf0f8]">
                Open {u.label.toLowerCase()} →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Privacy, honestly */}
      <section id="privacy" className="mx-auto max-w-[1100px] px-6 py-14">
        <div className="grid gap-3 border-b border-white/[0.07] pb-6 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)]">
          <h2 className="font-[family-name:var(--font-display)] text-[22px] font-semibold tracking-[-0.02em]">
            What&apos;s hidden, what isn&apos;t
          </h2>
          <p className="text-[13.5px] leading-relaxed text-[#7a859c]">
            A privacy pool on a public blockchain is not invisible - it&apos;s selectively
            decryptable. Here is exactly what that means, row by row, not a marketing promise.
          </p>
        </div>
        <div className="mt-6">
          <ThreatModelTable />
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/docs/privacy/who-sees-what"
            className="rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 py-2.5 text-[13px] font-medium text-[#d8deea] transition-colors hover:border-white/[0.2] hover:bg-white/[0.06]"
          >
            Who sees what, party by party →
          </Link>
          <Link
            href="/docs/privacy/the-hosted-account"
            className="rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 py-2.5 text-[13px] font-medium text-[#d8deea] transition-colors hover:border-white/[0.2] hover:bg-white/[0.06]"
          >
            The custodial exception →
          </Link>
          <Link
            href="/docs/privacy/refused-claims"
            className="rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 py-2.5 text-[13px] font-medium text-[#d8deea] transition-colors hover:border-white/[0.2] hover:bg-white/[0.06]"
          >
            What we refuse to claim →
          </Link>
        </div>
        <div className="mt-6 max-w-3xl rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 text-[13px] leading-relaxed text-[#a3acbd]">
          <p className="font-semibold text-[#eaf0f8]">Who holds the key that unlocks the &ldquo;revealed&rdquo; column?</p>
          <p className="mt-2">
            Your personal wallet generates and holds your viewing key on your own device the first
            time you shield with it - Sealed&apos;s app code never receives or stores it. The one
            exception is the hosted card-settlement account used to process swipes: it has its own
            separate, server-held viewing key so it can operate that one account. It cannot decrypt
            your personal wallet&apos;s notes.
          </p>
          <p className="mt-3 font-semibold text-[#eaf0f8]">Why does it have to be Ready?</p>
          <p className="mt-2">
            Private actions need a wallet that implements the Starknet privacy wallet API - the part
            that generates your viewing key on-device and produces the proofs behind every private
            transfer. Ready is the wallet that does this today. Other Starknet wallets can still hold
            your public funds; they just can&apos;t do the private actions yet.
          </p>
        </div>
      </section>

      {/* Proof */}
      <section id="proof" className="mx-auto max-w-[1100px] px-6 py-14">
        <h2 className="font-[family-name:var(--font-display)] text-[22px] font-semibold tracking-[-0.02em]">
          Not a demo recording - three settled transactions
        </h2>
        <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-[#7a859c]">
          Each of these is a real, confirmed Sepolia transaction. Click through to Voyager and read
          it yourself.
        </p>
        <div className="mt-6">
          <ProofPoints />
        </div>
        <Link
          href="/docs/evidence"
          className="mt-5 inline-block text-[13px] font-medium text-[#6ee9d5] underline decoration-[#6ee9d5]/30 underline-offset-4 transition-colors hover:decoration-[#6ee9d5]"
        >
          Every contract and transaction, with the file each value comes from →
        </Link>
      </section>

      <ContractsFooter />
    </div>
  );
}
