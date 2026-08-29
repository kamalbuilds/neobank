import type { Metadata } from 'next';
import { A, C, DocsPage, H2, Limit, P, Status, Table, type StatusKind } from '../components/prose';

export const metadata: Metadata = {
  title: 'Surface status - Sealed docs',
  description:
    'Every surface in Sealed marked live, partial, or not built, each with the transaction or test that proves the state.',
};

type Row = { name: string; kind: StatusKind; evidence: React.ReactNode };

const ROWS: Row[] = [
  {
    name: 'Shield and hold',
    kind: 'live',
    evidence: (
      <>
        Two mainnet shields, <C>0x04c4bea0…9193</C> and <C>0x059eb6c1…586e</C>, plus the full
        Sepolia loop.
      </>
    ),
  },
  {
    name: 'Card swipe settles from shielded value',
    kind: 'live',
    evidence: (
      <>
        Sepolia <C>0x1f815361…fe5df</C>, block 14,130,415. One transaction: sell shielded STRK, pay
        the merchant in USDC.
      </>
    ),
  },
  {
    name: 'Swipe that also opens a lending position',
    kind: 'live',
    evidence: (
      <>
        <C>0x4d94fa79…2639</C>, block 14,109,923. Pool withdrew 10.24 STRK, 0.24 paid the merchant,
        10 entered the vault; <C>AuthorizationSettled</C> and <C>PositionOpened</C> in the same
        receipt.
      </>
    ),
  },
  {
    name: 'Pay a swipe by redeeming vault shares',
    kind: 'live',
    evidence: (
      <>
        <C>0x45b8c5d7…f0e0</C>, block 14,111,945. <C>PositionRedeemed</C> plus{' '}
        <C>AuthorizationSettled</C>; vault <C>total_assets</C> went 10 STRK to 0.
      </>
    ),
  },
  {
    name: 'Funding in from Base over CCTP V2',
    kind: 'live',
    evidence: (
      <>
        Sepolia <C>0x28b053d9…11fe2</C>, block 14,139,603. Bridged USDC lands and shields in the
        same flow.
      </>
    ),
  },
  {
    name: 'Viewing-key scoped statements',
    kind: 'live',
    evidence: (
      <>
        <C>GET /api/card/statement?authorizationId=…&amp;full=1</C> returns the settlement and the
        lend. Without the key it omits amounts.
      </>
    ),
  },
  {
    name: 'Shadow spend identities',
    kind: 'partial',
    evidence: (
      <>
        One shadow spend settled on Sepolia, <C>0x48ccd889…cc111b</C>, block 14,130,089. Addresses
        are deterministic per nonce, but this is not yet the default path for every swipe.
      </>
    ),
  },
  {
    name: 'Card issuer',
    kind: 'partial',
    evidence: (
      <>
        A Lithic <em>sandbox</em> issuer is wired to a live authorization-decisioning webhook.
        Tampered HMAC returns 401; a policy-blocked merchant never settles; a replayed
        authorization id returns confirmed without settling twice.
      </>
    ),
  },
  {
    name: 'Contracts on mainnet',
    kind: 'not-built',
    evidence: (
      <>
        Every Sealed contract is deployed on Sepolia only. Mainnet has the two shields above and
        nothing else of ours.
      </>
    ),
  },
  {
    name: 'Real money, real card network',
    kind: 'not-built',
    evidence: <>No production issuer, no licence, no real funds. Test money throughout.</>,
  },
];

export default function StatusPage() {
  return (
    <DocsPage
      eyebrow="Start here"
      title="Surface status"
      lead="Every surface marked live, partial, or not built - each with the transaction hash or the test that proves the state, so the label is checkable rather than asserted."
      slug="status"
    >
      <P>
        <Status kind="live" /> means it has settled on chain or a test holds it. <Status kind="partial" />{' '}
        means it works but the claim around it needs narrowing.{' '}
        <Status kind="not-built" /> means it does not exist, stated plainly rather than omitted.
      </P>

      <H2>The table</H2>
      <Table
        head={['Surface', 'State', 'Evidence']}
        rows={ROWS.map((r) => [r.name, <Status key={r.name} kind={r.kind} />, r.evidence])}
      />

      <H2>Known defects</H2>
      <P>
        These are open, and listed here rather than discovered by you. Vault tabs do not preview
        their panel until a wallet is connected, so some spend and send copy sits behind the
        connect wall. Pool size and TVL figures disagree across sources, so no figure is published
        anywhere in this product.
      </P>
      <Limit>
        Settlement transactions above are confirmed <C>SUCCEEDED</C>; several are{' '}
        <C>ACCEPTED_ON_L2</C> rather than finalised on L1. The two mainnet shields are{' '}
        <C>ACCEPTED_ON_L1</C>. Where that distinction matters to you, check the hash yourself on{' '}
        <A href="/docs/evidence">the evidence page</A>.
      </Limit>
    </DocsPage>
  );
}
