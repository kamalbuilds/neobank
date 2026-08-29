import type { Metadata } from 'next';
import Link from 'next/link';
import { DOCS_NAV, hrefFor } from './nav';
import { A, C, DocsPage, H2, LI, P, Status, UL, type StatusKind } from './components/prose';

export const metadata: Metadata = {
  title: 'What Sealed is - Sealed docs',
  description:
    'A private money account on Starknet: hold, spend with a card, earn, and fund - with a row-by-row answer about what the public ledger can and cannot read.',
};

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
    kind: 'not-built',
    body: 'Three transactions have settled against the STRK20 pool on mainnet. Every contract in this documentation is deployed on Sepolia only, which is why the sprint scores those transactions as zero - see surface status.',
  },
];

export default function DocsOverview() {
  return (
    <DocsPage
      eyebrow="Start here"
      title="What Sealed is"
      lead="A private money account on Starknet's STRK20 pool - hold, swipe a card, earn, bridge in - and a row-by-row answer about what that does and does not hide."
      slug=""
    >
      <P>
        Sealed is an account that holds value as shielded notes inside{' '}
        <A href="/docs/evidence">StarkWare&apos;s STRK20 privacy pool</A> and spends it without
        publishing your balance. A card swipe sells shielded STRK, pays the merchant in USDC, and
        records the settlement, all inside one transaction on chain.
      </P>
      <P>
        Everything below runs on <strong className="font-semibold text-[#dce3ee]">Sepolia testnet</strong>
        : real transactions, test money. That is stated here first because it is the single most
        important qualifier on every other sentence in this documentation.
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
        because a privacy tool that overstates what it hides is worse than none at all - its users
        act on the difference.
      </P>

      <H2>What you can do with it today</H2>
      <P>
        Each row is the honest state, not the roadmap. The evidence for every{' '}
        <Status kind="live" /> row is a transaction hash on{' '}
        <A href="/docs/evidence">the evidence page</A>.
      </P>
      <div className="mt-6 flex flex-col gap-3">
        {SURFACES.map((s) => (
          <div
            key={s.name}
            className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4"
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[14.5px] font-semibold text-[#eaf0f8]">{s.name}</span>
              <Status kind={s.kind} />
            </div>
            <p className="mt-2 text-[13.5px] leading-relaxed text-[#8b95a8]">{s.body}</p>
          </div>
        ))}
      </div>

      <H2>What this is built on</H2>
      <P>
        The STRK20 pool is StarkWare&apos;s, not ours - a deployed privacy pool with audited
        cryptography. Sealed is an account, a card runtime, a lending vault and five helper
        contracts built on top of it. The distinction matters when you are deciding whom to trust:
        the cryptography is theirs, the product around it is ours and has not been audited by
        anyone.
      </P>
      <P>
        The helpers all follow the same shape - a Cairo contract invoked inside the pool&apos;s{' '}
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
                className="font-medium text-[#dce3ee] underline decoration-white/20 underline-offset-[3px] transition-colors hover:text-[#eaf0f8] hover:decoration-white/50"
              >
                {l.title}
              </Link>
              {' - '}
              {l.summary}
            </LI>
          ))}
      </UL>
    </DocsPage>
  );
}
