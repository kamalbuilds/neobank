import type { Metadata } from 'next';
import { A, C, DocsPage, H2, H3, LI, Limit, P, Table, UL } from '../../components/prose';

export const metadata: Metadata = {
  title: 'Who sees what - Sealed docs',
  description:
    'The five parties that touch a payment in Sealed and exactly what each one learns, including the ones you did not choose.',
};

export default function WhoSeesWhat() {
  return (
    <DocsPage
      eyebrow="Privacy"
      title="Who sees what"
      lead="A privacy pool on a public blockchain is not invisible, it is selectively decryptable. Here is who holds which decryption capability, party by party."
      slug="privacy/who-sees-what"
    >
      <P>
        Most privacy documentation describes what is hidden. That is the easy half. This page names
        the parties who can read things, because those are the ones that determine whether the
        product is right for you.
      </P>

      <H2>The five parties</H2>
      <H3>1. You</H3>
      <P>
        Your wallet derives and holds your viewing key on your device. It decrypts your notes and
        authorises spending them. Sealed&apos;s app code never receives or stores it.
      </P>

      <H3>2. The hosted card account</H3>
      <P>
        Card swipes are processed by a hosted account with its own server-held viewing key. It can
        read every note it owns and every swipe it settles. It cannot decrypt your self-custody
        wallet&apos;s notes - they are different keys - but everything you spend through the card
        passes through an account the operator controls. This is the custodial exception in an
        otherwise non-custodial product and it gets{' '}
        <A href="/docs/privacy/the-hosted-account">its own page</A>.
      </P>

      <H3>3. The relayer</H3>
      <P>
        Private operations are submitted by a relayer, so the transaction&apos;s{' '}
        <C>sender_address</C> is never yours. In exchange the relayer sees the submission itself:
        the timing, and the IP that asked for it unless you took separate steps about that. It
        cannot read your note contents.
      </P>

      <H3>4. The merchant</H3>
      <P>
        A card number and an amount in USDC. Not your balance, not your Starknet address, not your
        other activity. Without shadow identities, a merchant can link your repeat visits to each
        other - see <A href="/docs/how-it-works/the-swipe">the swipe</A>.
      </P>

      <H3>5. Anyone with a block explorer</H3>
      <P>
        That an address touched the pool and when. Every deposit and withdrawal amount, because
        those legs are ordinary ERC-20 transfers. The pool fee. The relayer as sender. Nothing about
        which notes were spent or what remains.
      </P>

      <H2>The same thing as a table</H2>
      <Table
        head={['What', 'Hidden', 'Public on chain', 'Readable with a viewing key']}
        rows={[
          [
            'Which notes were spent alongside yours',
            'Unlinkable, protected by the anonymity set',
            '—',
            '—',
          ],
          ['Sender and receiver of a private transfer', '—', '—', 'Either side\u2019s key'],
          ['Private transfer and spend amounts', '—', '—', 'A viewing-key holder'],
          ['Your shielded balance and history', '—', '—', 'A viewing-key holder'],
          ['Deposit and withdrawal amounts', '—', 'Always, no key needed', '—'],
          ['That an address touched the pool, and when', '—', 'Always, no key needed', '—'],
          ['The pool fee, paid in public STRK', '—', 'Always, no key needed', '—'],
          ['Transaction sender', 'Your address is not the sender', 'The relayer\u2019s address is', '—'],
        ]}
      />

      <H2>The anonymity set is not infinite</H2>
      <P>
        &ldquo;Unlinkable&rdquo; means unlinkable <em>within the set of notes that could plausibly
        have been the one spent</em>. On a testnet pool with few participants, that set is small.
        Privacy from an anonymity set is a function of how many other people are using it, and no
        amount of cryptography changes that.
      </P>
      <Limit>
        An unusual amount narrows the set further. If you are the only account that ever shielded a
        distinctive figure, the public legs can point at you regardless of what is encrypted.
      </Limit>

      <H2>Showing someone one payment</H2>
      <P>
        Because one key both reads and spends, there is nothing safe to hand over. The mechanism
        instead is a scoped statement for a single authorization:
      </P>
      <UL>
        <LI>
          <C>GET /api/card/statement?authorizationId=…</C> returns the settlement with amounts
          omitted.
        </LI>
        <LI>
          With <C>&amp;full=1</C> and the viewing key, it returns the full record: the merchant
          transaction, the settled amount, and any position opened by the same invoke.
        </LI>
        <LI>Scope is per authorization. It is not a key to your history.</LI>
      </UL>
    </DocsPage>
  );
}
