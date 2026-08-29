import type { Metadata } from 'next';
import { A, C, DocsPage, Evidence, H2, LI, Limit, P, Step, Steps, UL } from '../components/prose';

export const metadata: Metadata = {
  title: 'Quickstart - Sealed docs',
  description:
    'From opening the page to holding shielded value on Starknet Sepolia: what happens at each step, what it costs, and what becomes public.',
};

export default function Quickstart() {
  return (
    <DocsPage
      eyebrow="Start here"
      title="Quickstart"
      lead="From opening the page to holding shielded value - what happens at each step, what it costs you, and what each step writes to a public ledger."
      slug="quickstart"
    >
      <P>
        This is Sepolia. You need test STRK, not real money. Every step below writes a real
        transaction to a real chain that anyone can read, which is the point: the parts that are
        public are public, and this page says which ones.
      </P>

      <H2>Before you start</H2>
      <UL>
        <LI>
          <strong className="font-semibold text-[#dce3ee]">The Ready wallet.</strong> Private
          actions need a wallet implementing the Starknet privacy wallet API - the part that derives
          your viewing key on-device and produces the proofs behind a private transfer. Ready is the
          wallet that does this today. Other Starknet wallets can hold your public funds; they
          cannot do the private actions.
        </LI>
        <LI>
          <strong className="font-semibold text-[#dce3ee]">Public STRK for fees.</strong> The pool
          charges a fee per private operation, and it is paid in{' '}
          <em>public</em> STRK from your ordinary balance, not from your shielded notes. If your
          public STRK is empty, a shielded balance cannot move.
        </LI>
      </UL>
      <Limit>
        The fee is admin-settable on the pool (<C>set_fee_amount</C>), so this app reads it at
        runtime with <C>get_fee_amount</C> and never hardcodes a figure. A number printed in a doc
        would be wrong the first time it changed.
      </Limit>

      <H2>Shield your first balance</H2>
      <Steps>
        <Step title="Connect Ready and pick the network">
          <P>
            The app defaults to Sepolia before a wallet is attached; once connected, your
            wallet&apos;s own chain id wins. Connecting writes nothing on chain.
          </P>
        </Step>
        <Step title="Deposit STRK or USDC">
          <P>
            The deposit leg is an ordinary ERC-20 transfer into the pool, so{' '}
            <strong className="font-semibold text-[#dce3ee]">the amount and your address are
            public</strong>. What becomes private is everything after it. On a brand-new account
            this transaction also deploys the account before depositing, in the same flow.
          </P>
        </Step>
        <Step title="Your viewing key is generated on your device">
          <P>
            Ready derives it the first time you shield. Sealed&apos;s app code never receives or
            stores it. It is what decrypts your notes - and, on this pool, the same key that
            authorises spending, which is why there is no view-only version of it to hand to an
            accountant.
          </P>
        </Step>
        <Step title="Read your balance">
          <P>
            The balance on your screen is decrypted locally from your notes. An explorer looking at
            the same pool sees a deposit happened and nothing about what you now hold.
          </P>
        </Step>
      </Steps>
      <Evidence>
        Three transactions have settled against the pool on Starknet <em>mainnet</em>, not just
        Sepolia: <C>0x04c4bea0…9193</C> (STRK), <C>0x059eb6c1…586e</C> (USDC) and{' '}
        <C>0xe08fd329…0294</C>, all <C>SUCCEEDED</C> and finalised on L1. See{' '}
        <A href="/docs/evidence">Evidence</A>.
      </Evidence>

      <H2>Spend it</H2>
      <P>
        A card swipe does not withdraw first and pay second. The authorization, the STRK-to-USDC
        conversion, the merchant payment and the change re-shield are one transaction - if any leg
        fails, none of it happened. <A href="/docs/how-it-works/the-swipe">The swipe</A> takes that
        apart event by event.
      </P>
      <P>
        Swipes are processed by a hosted account, which is custodial and can read its own notes.
        Read <A href="/docs/privacy/the-hosted-account">the hosted account</A> before you use the
        card, not after.
      </P>

      <H2>Get value back out</H2>
      <P>
        Unshielding sends to a public address, and the amount and destination are visible on chain -
        that is the nature of the public leg, not a shortcoming of this app. Unshielding{' '}
        <em>MAX</em> spends the whole note; the pool fee still has to come from public STRK on top,
        which is why the app warns before an unshield when your public balance is short.
      </P>
      <P>
        <A href="/docs/how-it-works/funding">Funding and exit</A> covers the CCTP route in from Base
        Sepolia and what it does and does not conceal.
      </P>
    </DocsPage>
  );
}
