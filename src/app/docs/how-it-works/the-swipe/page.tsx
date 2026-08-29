import type { Metadata } from 'next';
import { A, C, DocsPage, Evidence, H2, LI, Limit, P, Step, Steps, Table, UL } from '../../components/prose';

export const metadata: Metadata = {
  title: 'The swipe - Sealed docs',
  description:
    'How one Starknet transaction authorizes a card payment, sells shielded STRK for USDC, pays the merchant, and re-shields the change.',
};

export default function TheSwipe() {
  return (
    <DocsPage
      eyebrow="How it works"
      title="The swipe"
      lead="A card authorization that sells shielded STRK, pays a merchant in USDC and records the settlement - as one transaction, so no intermediate state is ever exposed."
      slug="how-it-works/the-swipe"
    >
      <P>
        The naive version of this is three steps: withdraw from the pool, swap, then pay. Every one
        of those steps publishes something, and between them your value sits in the open. Sealed
        does it in a single <C>privacy_invoke</C>, so there is no in-between to observe and no leg
        that can succeed while another fails.
      </P>

      <H2>What happens in that one transaction</H2>
      <Steps>
        <Step title="The authorization arrives">
          <P>
            An issuer webhook posts the authorization. It is HMAC-signed; a tampered signature is
            rejected with 401 before anything touches a chain. This is a Lithic{' '}
            <em>sandbox</em> issuer, not a production card network.
          </P>
        </Step>
        <Step title="Policy decides, before money moves">
          <P>
            The <C>CardProgram</C> contract holds the per-swipe cap, the daily cap and the blocked
            categories. A blocked merchant is refused here and never reaches settlement. The daily
            spend counter is read back from the contract after the transaction, not tracked in the
            server&apos;s memory.
          </P>
        </Step>
        <Step title="The pool withdraws exactly what the swipe costs">
          <P>
            One withdrawal covers the merchant payment plus anything else the same invoke is doing.
            The amount that leaves is the amount needed, not a rounded-up float.
          </P>
        </Step>
        <Step title="The converter sells STRK for USDC just in time">
          <P>
            The JIT converter holds calldata quoted live from Ekubo and routed through a pinned AVNU
            router. It converts only at settlement, so no idle USDC balance sits around advertising
            what you are about to spend.
          </P>
        </Step>
        <Step title="The merchant is paid, the change re-shields">
          <P>
            Payment out, change back into the pool, one atomic step. The receipt carries{' '}
            <C>AuthorizationSettled</C>, and the replay map plus the daily spend total are readable
            on chain afterwards.
          </P>
        </Step>
      </Steps>

      <Evidence>
        Sepolia <C>0x1f815361…fe5df</C>, block 14,130,415 - a card authorization selling shielded
        STRK and paying the merchant in USDC in one transaction. The card-settlement contract is{' '}
        <A href="/docs/evidence">
          <C>0x074dcd5e…5390a</C>
        </A>
        .
      </Evidence>

      <H2>Why repeat swipes do not chain</H2>
      <P>
        Paying the same merchant twice from the same identity links those two payments to each
        other, whatever else is hidden. The shadow-account anonymizer derives a per-merchant
        identity so two visits do not share an address. Identities are deterministic per nonce, so
        the app can find them again without storing a map.
      </P>
      <Evidence>
        A shadow spend settled on Sepolia at <C>0x48ccd889…cc111b</C>, block 14,130,089, through
        the official ShadowAccountAnonymizer at <C>0x010a2285…d9b147</C>.
      </Evidence>
      <Limit>
        This is not yet the default path for every swipe. Card settlements today mostly run through
        the hosted account. Until that flips, treat &ldquo;repeat swipes do not link&rdquo; as a
        property of the shadow path specifically, not of every payment you make.
      </Limit>

      <H2>What the merchant and the chain each see</H2>
      <Table
        head={['Party', 'Sees', 'Does not see']}
        rows={[
          [
            'The merchant',
            'A card number and an amount in USDC',
            'Your balance, your other activity, your Starknet address',
          ],
          [
            'A chain observer',
            'That the pool was touched and a USDC payment was made',
            'Which notes were spent, or what remains',
          ],
          [
            'The hosted account operator',
            'Every swipe it settles, in full',
            'Nothing about your self-custody wallet notes',
          ],
        ]}
      />
      <P>
        The third row is the one people skip. It has{' '}
        <A href="/docs/privacy/the-hosted-account">its own page</A>.
      </P>

      <H2>What the tests actually hold</H2>
      <UL>
        <LI>A tampered HMAC returns 401, so a forged authorization cannot settle.</LI>
        <LI>A policy-blocked merchant does not settle, verified against the deployed contract.</LI>
        <LI>
          A repeated authorization id returns confirmed and does <em>not</em> settle twice - replay
          protection lives in the contract&apos;s own map, not in a server-side set.
        </LI>
        <LI>
          The settlement event parser is held by a mutation test: reading <C>keys[1]</C> instead of{' '}
          <C>keys[0]</C> turns it red. A parser test that passes either way proves nothing, so this
          one was checked by breaking it.
        </LI>
      </UL>
    </DocsPage>
  );
}
