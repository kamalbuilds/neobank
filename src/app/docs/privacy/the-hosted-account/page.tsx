import type { Metadata } from 'next';
import { A, C, DocsPage, H2, LI, Limit, P, Table, UL } from '../../components/prose';

export const metadata: Metadata = {
  title: 'The hosted account - Sealed docs',
  description:
    'The custodial exception inside a non-custodial product: the hosted card-settlement account, its server-held viewing key, and what it can read.',
};

export default function HostedAccount() {
  return (
    <DocsPage
      eyebrow="Privacy"
      title="The hosted account"
      lead="There is a custodial account in this product. It processes card swipes, it holds its own viewing key on a server, and this page exists so you find that out here rather than afterwards."
      slug="privacy/the-hosted-account"
    >
      <P>
        Sealed is otherwise non-custodial: your wallet derives your viewing key on your device, and
        the app code never receives it. The card is the exception, and it is a real one rather than
        a technicality.
      </P>

      <H2>What it is</H2>
      <P>
        A card authorization has to be decided in the time a terminal waits, and it has to be
        settled by a party that can sign. That party is a hosted Starknet account with its own
        shielded balance and its own <em>server-held</em> viewing key.
      </P>
      <UL>
        <LI>It can decrypt its own notes, because it has to spend them.</LI>
        <LI>It can read every swipe it settles: merchant, amount, time.</LI>
        <LI>
          It <strong className="font-semibold text-[#dce3ee]">cannot</strong> decrypt your
          self-custody wallet&apos;s notes. Different key, different account. Value you hold
          yourself is not readable by it.
        </LI>
      </UL>

      <H2>What that means for you</H2>
      <Table
        head={['If you...', 'Then the operator...']}
        rows={[
          [
            'Hold value in your own wallet',
            'Cannot read your balance or history. Your key never leaves your device.',
          ],
          [
            'Send a private transfer wallet to wallet',
            'Cannot read it. That path does not touch the hosted account.',
          ],
          [
            'Spend with the card',
            'Sees that swipe in full - merchant, amount, timing - because its own account settled it.',
          ],
          [
            'Fund the hosted account',
            'Custodies that value while it is there. It is not yours in the way your own notes are.',
          ],
        ]}
      />

      <Limit>
        If your threat model includes the operator of this product, do not route value through the
        card. The self-custody paths - hold, private transfer, unshield - do not involve the hosted
        account at all. That is the honest boundary, and it is a boundary rather than a promise.
      </Limit>

      <H2>Why it is not hidden behind &ldquo;non-custodial&rdquo;</H2>
      <P>
        &ldquo;Non-custodial&rdquo; is true of most of this product and false of one part of it. A
        blanket claim would be the more marketable sentence and the less accurate one, and a
        privacy tool that overstates what it hides is worse than none at all, because its users act
        on the difference.
      </P>
      <P>
        For the same reason, the two phrases a product like this most wants to use - the
        end-to-end claim and the &ldquo;nobody but you&rdquo; claim - are both on{' '}
        <A href="/docs/privacy/refused-claims">the refused list</A>. Each is false the moment a
        swipe happens, and a test fails if either reaches shipped copy.
      </P>

      <H2>What limits it</H2>
      <UL>
        <LI>
          Policy lives in the <C>CardProgram</C> contract, not in the server: per-swipe cap, daily
          cap, blocked categories. The operator cannot exceed a cap by editing application code.
        </LI>
        <LI>
          Replay protection is a map in the contract. A repeated authorization id returns confirmed
          and does not settle twice, held by a test.
        </LI>
        <LI>
          Authorization requests are HMAC-signed; a tampered signature is rejected before anything
          reaches a chain.
        </LI>
        <LI>
          Demo routes are gated behind a per-request token, and the recipient comes from server
          configuration rather than from whoever sent the request.
        </LI>
      </UL>
      <P>
        These constrain what the account can do. None of them constrain what it can{' '}
        <em>see</em>, which is the whole subject of this page.
      </P>
    </DocsPage>
  );
}
