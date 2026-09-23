import type { ReactNode } from 'react';
import Link from 'next/link';
import { neighbours, hrefFor } from '../nav';

/**
 * The vocabulary every docs page is written in. One place, so a page is prose
 * plus structure rather than prose plus a hundred Tailwind strings, and so the
 * type scale cannot drift page to page.
 *
 * The system is .brain/DESIGN-BRIEF.md: graphite chrome, hairline rules instead
 * of glass, 4px corners, Instrument Serif for display and Geist for body, every
 * figure in .figure so numbers line up in a column.
 *
 * SCALE. Six sizes, no half-pixels, and nothing between them:
 *
 *   34  page title (serif)
 *   26  section heading (serif)
 *   18  lead
 *   16  body, subheadings
 *   14  table cells, registers, every hash and figure
 *   12  micro labels, chips, column heads
 *
 * A page title used to be 46px, which made a category word the largest thing on
 * a page whose content is nine transaction statuses. It is 34 now, and the
 * evidence sits at 14 rather than 11. Weights are 400 for body, 600 for figures
 * and micro labels, 700 for headings: a real range rather than 500 and 600.
 *
 * MEASURE. 50ch, measured in the browser at 69 characters of ordinary Geist prose.
 * Narrative gets it; tables and registers do not.
 */

const MEASURE = 'max-w-[50ch]';

/** Turns a heading into the anchor id the TOC and deep links use. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export function H2({ children }: { children: string }) {
  return (
    <h2
      id={slugify(children)}
      className="mt-16 scroll-mt-28 border-t border-[color:var(--line)] pt-6 font-[family-name:var(--font-display)] text-[26px] font-normal leading-[1.15] tracking-[-0.02em] text-ink first:mt-0 first:border-t-0 first:pt-0"
    >
      {children}
    </h2>
  );
}

export function H3({ children }: { children: string }) {
  return <h3 className="mt-9 text-[16px] font-bold leading-snug text-ink">{children}</h3>;
}

export function P({ children }: { children: ReactNode }) {
  return <p className={`mt-5 ${MEASURE} text-[16px] leading-[1.75] text-ink/80`}>{children}</p>;
}

export function Lead({ children }: { children: ReactNode }) {
  return (
    <p className={`mt-5 ${MEASURE} text-pretty text-[18px] leading-[1.6] text-ink/85`}>
      {children}
    </p>
  );
}

export function UL({ children }: { children: ReactNode }) {
  return (
    <ul
      className={`mt-5 ${MEASURE} flex list-none flex-col gap-3 text-[16px] leading-[1.75] text-ink/80`}
    >
      {children}
    </ul>
  );
}

export function LI({ children }: { children: ReactNode }) {
  return (
    <li className="relative pl-5 before:absolute before:left-0 before:top-[0.78em] before:h-[3px] before:w-[3px] before:bg-ink/45">
      {children}
    </li>
  );
}

/** Inline code: hashes, entrypoints, file paths. Tabular, so digits line up. */
export function C({ children }: { children: ReactNode }) {
  return (
    <code className="figure rounded-[3px] border border-[color:var(--line)] bg-white/[0.05] px-1.5 py-0.5 text-[0.88em] font-medium text-ink">
      {children}
    </code>
  );
}

export function A({ href, children }: { href: string; children: ReactNode }) {
  const external = href.startsWith('http');
  const cls =
    'text-ink underline decoration-[color:var(--line-strong)] underline-offset-[3px] transition-[text-decoration-color] duration-150 hover:decoration-[color:var(--seal-text)]';
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}

/**
 * The "not applicable" cell in a matrix. A dash carries the meaning visually
 * and a screen reader gets the word, so a row read aloud is not a run of
 * silent gaps.
 */
export function Nil() {
  return (
    <span className="figure text-muted">
      <span aria-hidden="true">-</span>
      <span className="sr-only">not applicable</span>
    </span>
  );
}

/**
 * A claim with its evidence attached. Used wherever the docs assert something
 * happened on chain - the reader should never have to take a sentence's word
 * for it when a transaction hash exists. Ledger green, because the thing it
 * points at has settled.
 */
export function Evidence({ children }: { children: ReactNode }) {
  return (
    <aside
      className={`doc mt-6 ${MEASURE} border-l-2 border-l-[color:var(--green)] px-4 py-4 text-[14px] leading-[1.7] text-ink/80`}
    >
      <span className="figure mr-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[color:var(--green)]">
        Evidence
      </span>
      {children}
    </aside>
  );
}

/** The opposite of Evidence: a limit, stated before the reader hits it. */
export function Limit({ children }: { children: ReactNode }) {
  return (
    <aside
      className={`doc mt-6 ${MEASURE} border-l-2 border-l-[color:var(--seal)] px-4 py-4 text-[14px] leading-[1.7] text-ink/85`}
    >
      <span className="figure mr-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-seal-bright">
        Limit
      </span>
      {children}
    </aside>
  );
}

/**
 * A ruled matrix. Both axes carry hairlines, because a comparison table whose
 * columns are only implied gets read as a list of paragraphs.
 */
export function Table({
  head,
  rows,
  wide = false,
}: {
  head: string[];
  rows: ReactNode[][];
  /** Four columns or more need more room before they may wrap. */
  wide?: boolean;
}) {
  return (
    <div className="mt-7 overflow-x-auto rounded-[4px] border border-[color:var(--line)]">
      <table
        className={`w-full border-collapse text-left ${wide ? 'min-w-[720px]' : 'min-w-[560px]'}`}
      >
        <thead>
          <tr>
            {head.map((h, i) => (
              <th
                key={h}
                scope="col"
                className={`figure border-b border-[color:var(--line-strong)] bg-white/[0.03] px-4 py-3 align-bottom text-[12px] font-semibold uppercase tracking-[0.14em] text-muted ${
                  i > 0 ? 'border-l border-l-[color:var(--line)]' : ''
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="align-top">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`px-4 py-3 text-[14px] leading-[1.6] ${
                    i < rows.length - 1 ? 'border-b border-[color:var(--line)]' : ''
                  } ${
                    j > 0
                      ? 'border-l border-l-[color:var(--line)] text-ink/75'
                      : 'font-bold text-ink'
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type StatusKind = 'live' | 'partial' | 'not-built';

/**
 * One chip, three states, readable from across the room. Ledger green for
 * settled, seal vermilion for a claim that has to be narrowed, muted for a
 * thing that does not exist. Every combination clears 4.5:1 on chrome, and the
 * labels are load-bearing so none of them is abbreviated.
 */
const STATUS_STYLE: Record<StatusKind, { label: string; cls: string; dot: string }> = {
  live: {
    label: 'LIVE',
    cls: 'border-[color:var(--green)] bg-[color:var(--green-soft)] text-[color:var(--green)]',
    dot: 'bg-[color:var(--green)]',
  },
  partial: {
    label: 'PARTIAL',
    cls: 'border-[color:var(--seal-soft-2)] bg-[color:var(--seal-soft)] text-seal-bright',
    dot: 'bg-[color:var(--seal-text)]',
  },
  'not-built': {
    label: 'NOT BUILT',
    cls: 'border-[color:var(--line-strong)] bg-white/[0.03] text-muted',
    dot: 'bg-muted',
  },
};

export function Status({ kind }: { kind: StatusKind }) {
  const s = STATUS_STYLE[kind];
  return (
    <span
      className={`figure inline-flex items-center gap-1.5 whitespace-nowrap rounded-[3px] border px-2 py-[3px] text-[12px] font-semibold tracking-[0.12em] ${s.cls}`}
    >
      <span aria-hidden="true" className={`h-[5px] w-[5px] rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

/** Steps in a procedure, numbered by the browser rather than by hand. */
export function Steps({ children }: { children: ReactNode }) {
  return <ol className="mt-7 flex list-none flex-col gap-7 [counter-reset:step]">{children}</ol>;
}

export function Step({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="relative pl-12 [counter-increment:step] before:absolute before:left-0 before:top-[1px] before:flex before:h-7 before:w-7 before:items-center before:justify-center before:rounded-[3px] before:border before:border-[color:var(--line)] before:bg-white/[0.04] before:font-[family-name:var(--font-mono-ui)] before:text-[14px] before:font-semibold before:text-ink/80 before:content-[counter(step)]">
      <h3 className="text-[16px] font-bold leading-snug text-ink">{title}</h3>
      <div className="[&>p:first-child]:mt-2">{children}</div>
    </li>
  );
}

/** Reading order footer. Nobody should hit the bottom of a page and stop. */
export function DocsFooterNav({ slug }: { slug: string }) {
  const { prev, next } = neighbours(slug);
  if (!prev && !next) return null;
  const card = 'doc doc-interactive block rounded-[4px] p-4';
  return (
    <nav
      aria-label="Documentation pages"
      className="mt-20 grid gap-3 border-t border-[color:var(--line)] pt-8 sm:grid-cols-2"
    >
      {prev ? (
        <Link href={hrefFor(prev.slug)} className={card}>
          <span className="figure text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">
            Previous
          </span>
          <p className="mt-2 text-[16px] font-bold text-ink">{prev.title}</p>
          <p className="mt-1 text-[14px] leading-relaxed text-muted">{prev.summary}</p>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link href={hrefFor(next.slug)} className={`${card} text-right sm:col-start-2`}>
          <span className="figure text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">
            Next
          </span>
          <p className="mt-2 text-[16px] font-bold text-ink">{next.title}</p>
          <p className="mt-1 text-[14px] leading-relaxed text-muted">{next.summary}</p>
        </Link>
      ) : null}
    </nav>
  );
}

/** Every docs page's frame: eyebrow, title, lead, body, reading-order footer. */
export function DocsPage({
  eyebrow,
  title,
  lead,
  slug,
  children,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  slug: string;
  children: ReactNode;
}) {
  return (
    <article>
      <p className="figure text-[12px] font-semibold uppercase tracking-[0.2em] text-muted">
        {eyebrow}
      </p>
      <h1 className="mt-3 text-balance font-[family-name:var(--font-display)] text-[34px] font-normal leading-[1.1] tracking-[-0.025em] text-ink">
        {title}
      </h1>
      <p className={`mt-4 ${MEASURE} text-pretty text-[18px] leading-[1.6] text-ink/85`}>{lead}</p>
      <div className="mt-10 border-t border-[color:var(--line)] pt-10">{children}</div>
      <DocsFooterNav slug={slug} />
    </article>
  );
}
