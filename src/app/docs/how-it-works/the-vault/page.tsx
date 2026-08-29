import type { Metadata } from 'next';
import { A, C, DocsPage, Evidence, H2, LI, Limit, P, Table, UL } from '../../components/prose';

export const metadata: Metadata = {
  title: 'The vault - Sealed docs',
  description:
    'A card swipe that also opens a lending position in the same Starknet transaction, and the bug that taught us to expose allowance.',
};

export default function TheVault() {
  return (
    <DocsPage
      eyebrow="How it works"
      title="The vault"
      lead="Paying a bill and opening a lending position as one atomic invoke - and the redemption path that spends those shares back out."
      slug="how-it-works/the-vault"
    >
      <P>
        A swipe does not have to be only a payment. The same <C>privacy_invoke</C> that settles a
        restaurant bill can route the rest of the withdrawal into a lending vault, so idle balance
        starts working in the transaction that spent the rest of it.
      </P>
      <P>
        The point is atomicity rather than yield. Two separate transactions - pay, then deposit -
        publish an intermediate state where the value is out of the pool and not yet anywhere else.
        One transaction has no such moment.
      </P>

      <H2>A dinner that opened a position</H2>
      <P>
        The pool withdrew 10.24 STRK. The helper paid 0.24 STRK to the merchant and deposited 10
        STRK into the vault, emitting <C>AuthorizationSettled</C> and <C>PositionOpened</C> in the
        same receipt. Private STRK notes went from 18.26 to 8.02, and the vault&apos;s{' '}
        <C>total_assets</C> went from 0 to 10.
      </P>
      <Evidence>
        Sepolia <C>0x4d94fa79…2639</C>, block 14,109,923, <C>SUCCEEDED</C>. The Voyager receipt
        carries <C>AuthorizationSettled</C>, <C>PositionOpened</C>, the pool{' '}
        <C>Withdrawal</C> of 10.24 and an <C>OpenNoteDeposited</C>.
      </Evidence>

      <H2>Spending the position back out</H2>
      <P>
        Shares are not a one-way door. A later swipe can be paid by redeeming them: the vault
        returns the assets, the merchant is paid, and <C>total_assets</C> falls back to zero.
      </P>
      <Evidence>
        Sepolia <C>0x45b8c5d7…f0e0</C>, block 14,111,945. <C>PositionRedeemed</C> on the card
        program plus <C>AuthorizationSettled</C>; vault <C>total_assets</C> 10 STRK to 0, recipient
        up 0.24 STRK.
      </Evidence>

      <H2>The bug worth publishing</H2>
      <P>
        The first vault class did not expose an <C>allowance</C> entrypoint. Calling it reverted
        with <C>entrypoint does not exist</C>, which meant the STRK20 pool could not pull the
        share note, and the atomic dinner-plus-lend could not settle at all.
      </P>
      <P>
        The fix was a new class exposing <C>allowance</C>, deployed at{' '}
        <C>0x076811f2…cda8b</C>. The old vault at <C>0x00474c6b…68bb</C> is retired and stays
        listed in <A href="/docs/evidence">the evidence page</A> rather than being quietly deleted,
        because a contract that was live and then abandoned is exactly the kind of thing a reader
        deserves to find named.
      </P>
      <P>
        A second live failure came from the same family: the hosted account&apos;s STRK allowance
        was 1 STRK against a 2 STRK pool fee, so a hosted swipe reverted until the fee approval was
        topped up. Both are allowance bugs, and neither was visible from reading the code.
      </P>

      <H2>What is read live, and what is not claimed</H2>
      <Table
        head={['Figure', 'Where it comes from']}
        rows={[
          ['Vault total assets', <>A live <C>total_assets</C> call to the deployed contract on the Earn page</>],
          ['Daily card spend', <>Read back from <C>CardProgram</C> after settlement</>],
          ['Yield / APY', 'Not shown anywhere. Nothing here generates a rate to quote.'],
          ['Pool TVL', 'Not published. Sources disagree, so no figure is shown.'],
        ]}
      />
      <Limit>
        This is a demonstration lending vault on Sepolia holding test money. It is not a yield
        product, it has not been audited, and there is no rate to earn. What it proves is that a
        payment and a position can open in one atomic private invoke.
      </Limit>

      <H2>Tests behind it</H2>
      <UL>
        <LI>10 Cairo tests across the card program and the vault, run with snforge.</LI>
        <LI>
          The <C>allowance</C> regression is checked directly: the call reverts on the retired
          class and returns on the current one.
        </LI>
      </UL>
    </DocsPage>
  );
}
