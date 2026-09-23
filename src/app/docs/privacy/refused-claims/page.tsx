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

      {/* The register, not a cloud of tags. Each refusal gets its own ruled
          line and its own number, because a list a reader can count is a list
          a reader can hold the project to. */}
      <div className="mt-7 rounded-[4px] border border-[color:var(--line)]">
        <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[color:var(--line-strong)] bg-white/[0.03] px-4 py-3">
          <span className="figure text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">
            Refused phrases
          </span>
          <span className="figure text-[12px] font-semibold uppercase tracking-[0.14em] text-seal-bright">
            {FORBIDDEN_CLAIMS.length} refused
          </span>
        </header>
        <ul>
          {FORBIDDEN_CLAIMS.map((c, i) => (
            <li
              key={c.phrase}
              className="flex items-baseline gap-4 border-b border-[color:var(--line)] px-4 py-3 last:border-b-0"
            >
              <span className="figure w-6 shrink-0 text-[12px] font-semibold text-muted">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="figure text-[16px] text-ink/75 line-through decoration-[color:var(--seal-text)] decoration-2">
                {c.phrase}
              </span>
            </li>
          ))}
        </ul>
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
