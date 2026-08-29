import type { ReactNode } from 'react';
import Link from 'next/link';
import { neighbours, hrefFor } from '../nav';

/**
 * The vocabulary every docs page is written in. One place, so a page is prose
 * plus structure rather than prose plus a hundred Tailwind strings, and so the
 * type scale cannot drift page to page.
 */

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
      className="mt-14 scroll-mt-28 font-[family-name:var(--font-display)] text-[24px] font-semibold leading-tight tracking-[-0.02em] text-[#eaf0f8] first:mt-0"
    >
      {children}
    </h2>
  );
}

export function H3({ children }: { children: string }) {
  return (
    <h3 className="mt-8 text-[16px] font-semibold leading-snug text-[#eaf0f8]">{children}</h3>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p className="mt-4 text-[15px] leading-[1.72] text-[#aab3c4]">{children}</p>;
}

export function Lead({ children }: { children: ReactNode }) {
  return (
    <p className="mt-5 text-[17px] leading-[1.6] text-pretty text-[#c7cfdd]">{children}</p>
  );
}

export function UL({ children }: { children: ReactNode }) {
  return (
    <ul className="mt-4 flex list-none flex-col gap-2.5 text-[15px] leading-[1.7] text-[#aab3c4]">
      {children}
    </ul>
  );
}

export function LI({ children }: { children: ReactNode }) {
  return (
    <li className="relative pl-5 before:absolute before:left-0 before:top-[0.68em] before:h-1 before:w-1 before:rounded-full before:bg-[#4b5568]">
      {children}
    </li>
  );
}

/** Inline code: hashes, entrypoints, file paths. */
export function C({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-md border border-white/[0.07] bg-white/[0.045] px-1.5 py-0.5 font-[family-name:var(--font-mono-ui)] text-[0.86em] text-[#c9d4e4]">
      {children}
    </code>
  );
}

export function A({ href, children }: { href: string; children: ReactNode }) {
  const external = href.startsWith('http');
  const cls =
    'text-[#6ee9d5] underline decoration-[#6ee9d5]/30 underline-offset-[3px] transition-colors hover:decoration-[#6ee9d5]';
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
 * A claim with its evidence attached. Used wherever the docs assert something
 * happened on chain - the reader should never have to take a sentence's word
 * for it when a transaction hash exists.
 */
export function Evidence({ children }: { children: ReactNode }) {
  return (
    <div className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.022] px-4 py-3 text-[13px] leading-relaxed text-[#8b95a8]">
      <span className="mr-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#6ee9d5]">
        Evidence
      </span>
      {children}
    </div>
  );
}

/** The opposite of Evidence: a limit, stated before the reader hits it. */
export function Limit({ children }: { children: ReactNode }) {
  return (
    <div className="mt-5 rounded-xl border border-[#f8b471]/20 bg-[#f8b471]/[0.06] px-4 py-3 text-[13.5px] leading-relaxed text-[#e8cba8]">
      <span className="mr-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#f8b471]">
        Limit
      </span>
      {children}
    </div>
  );
}

export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="mt-6 overflow-x-auto rounded-2xl border border-white/[0.07]">
      <table className="w-full min-w-[520px] border-collapse text-left">
        <thead>
          <tr className="bg-white/[0.03]">
            {head.map((h) => (
              <th
                key={h}
                scope="col"
                className="border-b border-white/[0.07] px-4 py-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#8b95a8]"
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
                  className={`px-4 py-3 text-[13.5px] leading-relaxed ${
                    i < rows.length - 1 ? 'border-b border-white/[0.05]' : ''
                  } ${j === 0 ? 'font-medium text-[#dce3ee]' : 'text-[#8b95a8]'}`}
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

const STATUS_STYLE: Record<StatusKind, { label: string; cls: string }> = {
  live: { label: 'LIVE', cls: 'border-[#34d399]/25 bg-[#34d399]/10 text-[#6ee7b7]' },
  partial: { label: 'PARTIAL', cls: 'border-[#f8b471]/25 bg-[#f8b471]/10 text-[#f0c08a]' },
  'not-built': { label: 'NOT BUILT', cls: 'border-white/[0.12] bg-white/[0.04] text-[#8b95a8]' },
};

export function Status({ kind }: { kind: StatusKind }) {
  const s = STATUS_STYLE[kind];
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] ${s.cls}`}
    >
      {s.label}
    </span>
  );
}

/** Steps in a procedure, numbered by the browser rather than by hand. */
export function Steps({ children }: { children: ReactNode }) {
  return (
    <ol className="mt-6 flex list-none flex-col gap-6 [counter-reset:step]">{children}</ol>
  );
}

export function Step({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="relative pl-11 [counter-increment:step] before:absolute before:left-0 before:top-0 before:flex before:h-7 before:w-7 before:items-center before:justify-center before:rounded-full before:border before:border-white/[0.1] before:bg-white/[0.04] before:font-[family-name:var(--font-mono-ui)] before:text-[12px] before:text-[#8b95a8] before:content-[counter(step)]">
      <h3 className="text-[15.5px] font-semibold leading-snug text-[#eaf0f8]">{title}</h3>
      <div className="[&>p:first-child]:mt-2">{children}</div>
    </li>
  );
}

/** Reading order footer. Nobody should hit the bottom of a page and stop. */
export function DocsFooterNav({ slug }: { slug: string }) {
  const { prev, next } = neighbours(slug);
  if (!prev && !next) return null;
  return (
    <nav
      aria-label="Documentation pages"
      className="mt-16 grid gap-3 border-t border-white/[0.07] pt-8 sm:grid-cols-2"
    >
      {prev ? (
        <Link
          href={hrefFor(prev.slug)}
          className="group rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 transition-colors hover:border-white/[0.16] hover:bg-white/[0.04]"
        >
          <span className="text-[11px] text-[#687287]">← Previous</span>
          <p className="mt-1 text-[14px] font-semibold text-[#dce3ee]">{prev.title}</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[#7a859c]">{prev.summary}</p>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          href={hrefFor(next.slug)}
          className="group rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 text-right transition-colors hover:border-white/[0.16] hover:bg-white/[0.04] sm:col-start-2"
        >
          <span className="text-[11px] text-[#687287]">Next →</span>
          <p className="mt-1 text-[14px] font-semibold text-[#dce3ee]">{next.title}</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[#7a859c]">{next.summary}</p>
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
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[#6ee9d5]">
        {eyebrow}
      </p>
      <h1 className="mt-3 text-balance font-[family-name:var(--font-display)] text-[clamp(2rem,4.2vw,2.9rem)] font-medium leading-[1.08] tracking-[-0.03em] text-[#eaf0f8]">
        {title}
      </h1>
      <p className="mt-4 max-w-2xl text-pretty text-[16.5px] leading-[1.6] text-[#8b95a8]">
        {lead}
      </p>
      <div className="mt-12">{children}</div>
      <DocsFooterNav slug={slug} />
    </article>
  );
}
