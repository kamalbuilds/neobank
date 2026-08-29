import type { Metadata } from 'next';
import { A, C, DocsPage, H2, LI, Limit, P, Table, UL } from '../../components/prose';

export const metadata: Metadata = {
  title: 'The account - Sealed docs',
  description:
    'Notes, viewing keys, the pool fee, and why private actions require the Ready wallet on Starknet.',
};

export default function TheAccount() {
  return (
    <DocsPage
      eyebrow="How it works"
      title="The account"
      lead="What a balance actually is here - notes, not a number in a database - and the one key that reads and spends them."
      slug="how-it-works/the-account"
    >
      <P>
        There is no account balance stored anywhere in this product. What exists is a set of{' '}
        <strong className="font-semibold text-[#dce3ee]">notes</strong> inside the STRK20 pool, each
        encrypted, each decryptable only by the key that owns it. The number on your screen is the
        result of decrypting your own notes locally and adding them up.
      </P>
      <P>
        This is why an explorer can see the pool grow and still not know what you hold. It is also
        why a note is spent whole: unshielding &ldquo;MAX&rdquo; is not a preference, it is what
        spending a note means.
      </P>

      <H2>The viewing key</H2>
      <P>
        Ready derives it on your device the first time you shield. Sealed&apos;s app code never
        receives it and never stores it. It decrypts your notes, and on this pool it is also what
        authorises spending them.
      </P>
      <Limit>
        One key both reads and spends. There is no view-only derivation to give an accountant, an
        auditor, or a spouse. If you want somebody to see one payment, the mechanism is a{' '}
        <A href="/docs/privacy/who-sees-what">scoped statement</A> for that one authorization, not
        a key you hand over.
      </Limit>

      <H2>Why it has to be Ready</H2>
      <P>
        Private actions need a wallet that implements the Starknet privacy wallet API: deriving the
        viewing key on-device and producing the proofs behind a private transfer. Ready is the
        wallet that does this today. Any Starknet wallet can hold your public STRK; only a
        privacy-API wallet can perform the private half.
      </P>
      <P>
        This is a real constraint on who can use the product, so it is on this page rather than
        buried in an error state after you have already connected something else.
      </P>

      <H2>The fee, and why no number is printed here</H2>
      <P>
        Every private operation costs a pool fee, charged in <em>public</em> STRK from your ordinary
        balance - never from your shielded notes. A shielded balance with no public STRK behind it
        cannot move.
      </P>
      <P>
        The fee is admin-settable on the pool via <C>set_fee_amount</C>. The app therefore reads it
        at runtime with <C>get_fee_amount</C> and shows the live figure. No number is hardcoded in
        this documentation, because it would be wrong the first time StarkWare changed it and
        nothing here would fail to tell you.
      </P>

      <H2>What each leg publishes</H2>
      <Table
        head={['Action', 'Public on chain', 'Needs your key to read']}
        rows={[
          ['Deposit / shield', 'Your address, the token, the amount', '—'],
          ['Private transfer', 'That the pool was touched, and when', 'Sender, receiver, amount'],
          ['Holding a balance', 'Nothing beyond the deposit that created it', 'Balance and history'],
          ['Unshield / withdraw', 'Destination address and amount', '—'],
          ['Pool fee', 'Always visible, paid in public STRK', '—'],
        ]}
      />
      <P>
        The relayer, not you, is the transaction sender on a private operation, so your address is
        not the <C>sender_address</C> on those transactions.{' '}
        <A href="/docs/privacy/who-sees-what">Who sees what</A> covers what the relayer learns in
        exchange.
      </P>

      <H2>Account lifecycle</H2>
      <UL>
        <LI>
          A brand new account is deployed by its own first shield - the deploy and the deposit are
          one flow, not two things you have to remember to do in order.
        </LI>
        <LI>
          Receive strings are Bech32m, <C>strk1</C> for public and <C>strkx1</C> for shielded, so a
          typo fails a checksum instead of sending money into nowhere. This encoding is Sealed&apos;s
          own convention, not an official Starknet standard.
        </LI>
      </UL>
    </DocsPage>
  );
}
