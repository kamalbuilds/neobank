import type { Metadata } from 'next';
import { A, C, DocsPage, Evidence, H2, Limit, P, Table } from '../../components/prose';

export const metadata: Metadata = {
  title: 'Funding and exit - Sealed docs',
  description:
    'Bringing USDC in from Base Sepolia over CCTP V2 so it lands already shielded, and what unshielding out publishes.',
};

export default function Funding() {
  return (
    <DocsPage
      eyebrow="How it works"
      title="Funding and exit"
      lead="How value gets in without a separate exposed deposit step, and exactly what leaving publishes."
      slug="how-it-works/funding"
    >
      <P>
        The ordinary way to fund a privacy pool from another chain is two moves: bridge to a public
        Starknet address, then deposit. The public address sits in the middle holding your money,
        and both legs are attributable to you.
      </P>
      <P>
        Sealed&apos;s inbound lane uses Circle&apos;s CCTP V2 from Base Sepolia and claims and
        shields in the same flow, so the arriving USDC does not idle at a public address waiting for
        a second transaction you might forget to send.
      </P>
      <Evidence>
        Sepolia <C>0x28b053d9…11fe2</C>, block 14,139,603 - bridged USDC landing and shielding in
        one flow.
      </Evidence>

      <H2>What the inbound lane does not hide</H2>
      <P>
        CCTP burns on Base and mints on Starknet. Both of those are public events on public chains.
        Anyone watching can see that an amount crossed and roughly when.
      </P>
      <Limit>
        The narrow true claim is that the funds arrive already inside the pool, with no separate
        exposed deposit and no public idle balance. It is <em>not</em> that the crossing is
        invisible. A bridge that hid its own transfers would not be a bridge.
      </Limit>

      <H2>Going out</H2>
      <P>
        Unshielding sends to a public address. The destination and the amount are visible, because
        that is the definition of the public leg. The pool fee is charged in public STRK on top, so
        the app warns before an unshield when your public STRK cannot cover it - a warning added
        after that exact failure happened live.
      </P>
      <P>
        Unshielding MAX spends the whole note rather than a chosen slice, which follows from{' '}
        <A href="/docs/how-it-works/the-account">how notes work</A> rather than from any policy
        decision here.
      </P>
      <P>
        A separate public CCTP hop out to Base or Solana exists from native Starknet USDC. It is
        public by construction and labelled that way in the app.
      </P>

      <H2>Each route, and what it publishes</H2>
      <Table
        head={['Route', 'Public', 'Private']}
        rows={[
          [
            'CCTP in from Base',
            'The burn on Base and the mint on Starknet',
            'What you subsequently hold, once it is shielded',
          ],
          [
            'Direct shield',
            'Your address, token and amount on the deposit leg',
            'Everything after it',
          ],
          [
            'Unshield out',
            'Destination address, amount, and the STRK fee',
            'Which notes funded it',
          ],
          ['CCTP hop out', 'Entirely public, by design and by label', '—'],
        ]}
      />
    </DocsPage>
  );
}
