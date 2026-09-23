import type { Metadata } from 'next';
import Link from 'next/link';
import { DOCS_NAV, hrefFor } from './nav';
import { CONTRACT_RECORD, RETIRED_CONTRACTS, TX_RECORD } from '@/lib/evidence';
import { ageInHours, isStale, readAttestation, stampLine } from '@/lib/evidence-verification';
import { A, C, DocsPage, H2, LI, P, Status, UL, type StatusKind } from './components/prose';

export const metadata: Metadata = {
  title: 'What Sealed is - Sealed docs',
  description:
    'A private money account on Starknet: hold, spend with a card, earn, and fund, with a row-by-row answer about what the public ledger can and cannot read.',
};

/**
 * Every numeral on this page is counted out of the records rather than typed.
 * The page used to open with two paragraphs of definition and put the one
 * number that decides whether a reader keeps reading, the settled mainnet
 * count, in the third. A documentation front page for a product whose entire
 * argument is "check it yourself" has to lead with the things that can be
 * checked.
 */
const MAINNET_TX = TX_RECORD.filter((r) => r.network === 'mainnet').length;
const SEPOLIA_TX = TX_RECORD.length - MAINNET_TX;
const CONTRACTS = CONTRACT_RECORD.length;
const CONTRACTS_OURS = CONTRACT_RECORD.filter((c) => c.origin === 'sealed').length;
const CONTRACTS_STARKWARE = CONTRACTS - CONTRACTS_OURS;
const RETIRED = RETIRED_CONTRACTS.length;

const COUNTS: { figure: string; label: string; detail: string }[] = [
  {
    figure: String(MAINNET_TX),
    label: 'settled on mainnet',
    detail: 'Real STRK, all SUCCEEDED, against the canonical STRK20 pool.',
  },
  {
    figure: String(SEPOLIA_TX),
    label: 'settled on Sepolia',
    detail: 'Card swipes, the bridge, and the vault. Test money, real transactions.',
  },
  {
    figure: String(CONTRACTS),
    label: 'contracts on chain',
    detail: `${CONTRACTS_OURS} deployed by Sealed, ${CONTRACTS_STARKWARE} StarkWare's and used as found.`,
  },
  {
    figure: String(RETIRED),
    label: RETIRED === 1 ? 'deployment retired' : 'deployments retired',
    detail: 'Listed rather than deleted, with the bug that killed it named.',
  },
];

const SURFACES: { name: string; kind: StatusKind; body: string }[] = [
  {
    name: 'Hold',
    kind: 'live',
    body: 'Shield STRK or USDC into the STRK20 pool and hold it as notes. Your balance is decryptable by your viewing key, not by the explorer.',
  },
  {
    name: 'Spend',
    kind: 'live',
    body: 'A card authorization settles from shielded value in a single Sepolia transaction: sell STRK, pay the merchant in USDC, record the settlement.',
  },
  {
    name: 'Earn',
    kind: 'live',
    body: 'A restaurant swipe can open a lending position in the same invoke that pays the bill. total_assets is read live from the deployed vault, never projected.',
  },
  {
    name: 'Fund',
    kind: 'live',
    body: 'USDC bridged from Base Sepolia over CCTP V2 lands and shields in one flow, so value arrives already inside the pool.',
  },
  {
    name: 'Statements',
    kind: 'live',
    body: 'A viewing-key scoped statement for one authorization. Without the key it omits amounts; with it, the full settlement is readable.',
  },
  {
    name: 'Shadow spend',
    kind: 'partial',
    body: 'Per-merchant spend identities are deployed and deterministic, and one shadow spend has settled on Sepolia. It is not yet the default path for every swipe.',
  },
  {
    name: 'Real card issuer',
    kind: 'partial',
    body: 'A Lithic sandbox issuer is wired to a live authorization-decisioning webhook. No production issuer, no real network, no real money.',
  },
  {
    name: 'Mainnet',
    kind: 'partial',
    body: 'Four transactions have settled against the live STRK20 pool on mainnet: two shields and two viewing-key registrations, all SUCCEEDED. Holding and shielding are therefore live with real STRK. Every contract in this documentation is still deployed on Sepolia only, so the card, vault and bridge loops are not on mainnet, per surface status.',
  },
];

/**
 * The stamp the last verification run wrote, never a sentence claiming the
 * page was checked. A missing file, a failure and an old run each read
 * differently, because "verified" with no date is indistinguishable from
 * "verified once, in 2024".
 */
function VerificationStamp() {
  const a = readAttestation();

  if (!a) {
    return (
      <p
        className="figure mt-6 max-w-[62ch] border-l-2 border-[color:var(--seal)] pl-3.5 text-[14px] leading-[1.7] text-ink/85"
        role="alert"
      >
        No attestation file was found, so nothing on this page has been read back against a chain.
        Run <C>node scripts/verify-evidence.mjs</C> before trusting a figure above.
      </p>
    );
  }

  const failed = a.failed > 0;
  const stale = isStale(a);
  const hours = Math.round(ageInHours(a));
  const border = failed
    ? 'border-[color:var(--seal)]'
    : stale
      ? 'border-[color:var(--line-strong)]'
      : 'border-[color:var(--green)]';
  const qualifier = failed
    ? ' Values that failed are not corrected here; the run output is the authority.'
    : stale
      ? ` That run finished ${hours} hours ago, so treat it as stale and run the script again.`
      : ` Checked ${hours === 0 ? 'less than an hour' : hours === 1 ? '1 hour' : `${hours} hours`} ago, live against the RPCs named in the script.`;

  return (
    <p
      className={`figure mt-6 max-w-[62ch] border-l-2 pl-3.5 text-[14px] leading-[1.7] text-ink/85 ${border}`}
    >
      {stampLine(a)}.{qualifier}
    </p>
  );
}

export default function DocsOverview() {
  return (
    <DocsPage
      eyebrow="Start here"
      title="What Sealed is"
      lead={`${MAINNET_TX} transactions have settled against StarkWare's canonical STRK20 privacy pool on Starknet mainnet, and ${SEPOLIA_TX} more on Sepolia, across ${CONTRACTS} contracts you can open in an explorer. This page defines the product around them.`}
      slug=""
    >
      {/* A ruled strip of figures, not feature cards: no icon, no heading, one
          numeral per cell. The hairlines are the grid gap showing through, so
          the rules never double up at an edge. */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[4px] border border-[color:var(--line)] bg-[color:var(--line)] sm:grid-cols-4">
        {COUNTS.map((c) => (
          <div key={c.label} className="bg-chrome px-4 py-4">
            <span className="figure block text-[34px] font-semibold leading-none tracking-[-0.02em] text-ink">
              {c.figure}
            </span>
            <span className="mt-2 block text-[14px] font-bold leading-snug text-ink">
              {c.label}
            </span>
            <span className="mt-1.5 block text-[14px] leading-[1.55] text-ink/70">{c.detail}</span>
          </div>
        ))}
      </div>

      <VerificationStamp />

      <P>
        A private money account on Starknet&apos;s STRK20 pool, meaning hold, swipe a card, earn and
        bridge in, plus a row-by-row answer about what that does and does not hide.
      </P>
      <P>
        Sealed is an account that holds value as shielded notes inside{' '}
        <A href="/docs/evidence">StarkWare&apos;s STRK20 privacy pool</A> and spends it without
        publishing your balance. A card swipe sells shielded STRK, pays the merchant in USDC, and
        records the settlement, all inside one transaction on chain.
      </P>
      <P>
        Holding and shielding are{' '}
        <strong className="font-bold text-ink">live on Starknet mainnet</strong>, through
        the canonical STRK20 pool, with four settled transactions and real STRK spent on the pool
        fee. Everything built on top of that, the card swipe, the earn vault and the CCTP bridge,
        runs on <strong className="font-bold text-ink">Sepolia testnet</strong> with test
        money, because those are this project&apos;s own contracts and they are deployed on Sepolia
        only. That split is stated here first because it qualifies every other sentence in this
        documentation: check which network a page names before reading a number off it.
      </P>

      <H2>The part that is actually different</H2>
      <P>
        It is not the privacy claim. Every product in this category claims privacy. It is that this
        one names the parties who can read your activity <em>before</em> you act, including the one
        you did not choose.
      </P>
      <P>
        There is a hosted account in this product. It processes card swipes, and it holds its own
        server-side viewing key. That account is custodial, inside a product that is otherwise not.
        It gets <A href="/docs/privacy/the-hosted-account">its own page</A> rather than a footnote,
        because a privacy tool that overstates what it hides is worse than none at all: its users
        act on the difference.
      </P>

      <H2>What you can do with it today</H2>
      <P>
        Each row is the honest state, not the roadmap. The evidence for every{' '}
        <Status kind="live" /> row is a transaction hash on{' '}
        <A href="/docs/evidence">the evidence page</A>.
      </P>
      <div className="mt-7 rounded-[4px] border border-[color:var(--line)]">
        {SURFACES.map((s) => (
          <div
            key={s.name}
            className="border-b border-[color:var(--line)] px-4 py-4 last:border-b-0"
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[16px] font-bold text-ink">{s.name}</span>
              <Status kind={s.kind} />
            </div>
            <p className="mt-2 max-w-[58ch] text-[14px] leading-[1.65] text-ink/75">{s.body}</p>
          </div>
        ))}
      </div>

      <H2>What this is built on</H2>
      <P>
        The STRK20 pool is StarkWare&apos;s, not ours: a deployed privacy pool with audited
        cryptography. Sealed is an account, a card runtime, a lending vault and five helper
        contracts built on top of it. The distinction matters when you are deciding whom to trust:
        the cryptography is theirs, the product around it is ours and has not been audited by
        anyone.
      </P>
      <P>
        The helpers all follow the same shape, a Cairo contract invoked inside the pool&apos;s{' '}
        <C>privacy_invoke</C>, so a withdrawal, a swap, a payment and a re-shield land as one
        atomic transaction. <A href="/docs/how-it-works/the-swipe">The swipe</A> walks through a
        real one, event by event.
      </P>

      <H2>Where to go next</H2>
      <UL>
        {DOCS_NAV.flatMap((s) => s.links)
          .filter((l) => l.slug)
          .map((l) => (
            <LI key={l.slug}>
              <Link
                href={hrefFor(l.slug)}
                className="font-bold text-ink underline decoration-[color:var(--line-strong)] underline-offset-[3px] transition-[text-decoration-color] duration-150 hover:decoration-[color:var(--seal-text)]"
              >
                {l.title}
              </Link>
              {' · '}
              {l.summary}
            </LI>
          ))}
      </UL>
    </DocsPage>
  );
}
