import type { Metadata } from 'next';
import Link from 'next/link';
import { DocsSidebar, DocsMobileNav } from './components/DocsSidebar';
import { DocsToc } from './components/DocsToc';

export const metadata: Metadata = {
  title: 'Sealed documentation',
  description:
    'How a private money account on Starknet works, what it hides, what it does not, and the transactions that prove each claim.',
};

/**
 * Three columns on desktop - nav, prose, TOC - collapsing to one on narrow
 * screens with the nav behind a button. The prose column is capped at 780px
 * because a 1100px-wide paragraph is unreadable regardless of how good the
 * typography is; the text inside it is capped tighter still, at 62ch.
 *
 * Evidence and Refused claims sit in the masthead rather than only in the rail.
 * They are the two pages that decide whether a reader trusts the rest, and a
 * credibility asset buried three clicks deep is a credibility asset nobody
 * reads.
 */
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="vault-bg min-h-[100dvh] text-ink">
      <header className="sticky top-0 z-30 border-b border-[color:var(--line)] bg-chrome">
        <div className="mx-auto flex max-w-[1360px] items-center justify-between gap-4 px-5 py-3 lg:px-8">
          <div className="flex items-baseline gap-3">
            <Link
              href="/"
              className="font-[family-name:var(--font-display)] text-[26px] leading-none tracking-[-0.02em] text-ink"
            >
              Sealed<span className="text-muted">.cash</span>
            </Link>
            <span aria-hidden="true" className="text-[12px] text-muted">
              /
            </span>
            <span className="figure text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">
              Docs
            </span>
          </div>
          <div className="flex items-center gap-5">
            <Link
              href="/docs/evidence"
              className="hidden text-[14px] text-ink/80 transition-colors duration-150 hover:text-ink sm:inline"
            >
              Evidence
            </Link>
            <Link
              href="/docs/privacy/refused-claims"
              className="hidden text-[14px] text-ink/80 transition-colors duration-150 hover:text-ink md:inline"
            >
              Refused claims
            </Link>
            <Link
              href="/app"
              className="rounded-[4px] bg-paper px-3.5 py-1.5 text-[14px] font-bold text-paper-ink transition-transform duration-150 active:scale-[0.97]"
            >
              Open the app
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1360px] gap-10 px-5 py-10 lg:px-8 lg:py-16">
        <aside className="sticky top-[64px] hidden h-[calc(100dvh-96px)] w-[236px] shrink-0 overflow-y-auto pb-10 lg:block">
          <DocsSidebar />
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-8 lg:hidden">
            <DocsMobileNav />
          </div>
          <div className="max-w-[780px]">{children}</div>
        </main>

        <aside className="sticky top-[64px] hidden h-fit w-[200px] shrink-0 xl:block">
          <DocsToc />
        </aside>
      </div>
    </div>
  );
}
