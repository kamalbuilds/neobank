import type { Metadata } from 'next';
import { FORBIDDEN_CLAIMS } from '@/lib/forbidden-claims';
import { A, C, DocsPage, H2, P, Table } from '../../components/prose';

export const metadata: Metadata = {
  title: 'Refused claims - Sealed docs',
  description:
    'The phrases Sealed will not say about itself, kept as data and enforced by a test rather than by good intentions.',
};

export default function RefusedClaims() {
  return (
    <DocsPage
      eyebrow="Privacy"
      title="Refused claims"
      lead="The phrases that are false about this system, kept as data rather than as a style guide - because a style guide is advice and a list is testable."
      slug="privacy/refused-claims"
    >
      <P>
        These phrases are false about Sealed as deployed. They live in{' '}
        <C>src/lib/forbidden-claims.ts</C>, each with the reason it is false written beside it, and{' '}
        <C>tests/forbidden-claims.test.ts</C> sweeps every shipped copy module for them. A phrase on
        this list cannot reach production without turning the suite red.
      </P>

      <div className="mt-6 flex flex-wrap gap-2">
        {FORBIDDEN_CLAIMS.map((c) => (
          <span
            key={c.phrase}
            className="rounded-full border border-white/[0.09] px-3 py-1.5 font-[family-name:var(--font-mono-ui)] text-[12px] text-[#7a859c] line-through decoration-[#f87171]/70 decoration-2"
          >
            {c.phrase}
          </span>
        ))}
      </div>

      <H2>Why some of them read as fragments</H2>
      <P>
        They are substrings the test sweeps for, not sentences.{' '}
        <C>only you can see</C> catches &ldquo;only you can see your balance&rdquo; and every
        variation of it without anybody having to enumerate the variations.
      </P>

      <H2>Why each one is false here</H2>
      <Table
        head={['Phrase', 'Why it is false']}
        rows={FORBIDDEN_CLAIMS.map((c) => [<C key={c.phrase}>{c.phrase}</C>, c.reason])}
      />

      <H2>What the list does not buy</H2>
      <P>
        Stated precisely, because a page about not overstating things is a bad place to overstate
        one. The test sweeps the docs, the landing page and the marketing components. It does not
        sweep every string in the application, and it cannot sweep a screenshot, a tweet or a demo
        video narration.
      </P>
      <P>
        Below those modules this is a list a human has to mean. That is why it is published here
        rather than only enforced in CI.
      </P>

      <H2>The narrow claim usually survives</H2>
      <P>
        The value of the list is not that it deletes sentences. It is that it forces the true,
        narrower version of each one:
      </P>
      <Table
        head={['What you wanted to say', 'What is actually true']}
        rows={[
          [
            'Your address never appears',
            'Your address is not the transaction sender on a private operation. It does appear on the deposit.',
          ],
          [
            'Amounts are private',
            'Private transfer amounts need a viewing key. Deposit, withdrawal and fee amounts are public.',
          ],
          [
            'Only you can see your balance',
            'Your wallet notes need your key. The hosted card account reads its own.',
          ],
          [
            'Untraceable',
            'Unlinkable within the anonymity set, which on this testnet pool is small.',
          ],
        ]}
      />
      <P>
        Every replacement is weaker and every replacement is checkable. That is the trade this
        product keeps making, and{' '}
        <A href="/docs/privacy/who-sees-what">who sees what</A> is the long form of it.
      </P>
    </DocsPage>
  );
}
