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
 * screens with the nav behind a button. The prose column is capped at 720px
 * because a 1100px-wide paragraph is unreadable regardless of how good the
 * typography is.
 */
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="vault-bg min-h-[100dvh] text-[#eaf0f8]">
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#06070b]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-5 py-3.5 lg:px-8">
          <div className="flex items-baseline gap-3">
            <Link href="/" className="font-[family-name:var(--font-display)] text-[15px] font-semibold tracking-[-0.01em]">
              <span className="bg-gradient-to-r from-[#2dd4bf] via-[#38bdf8] to-[#818cf8] bg-clip-text text-transparent">
                Sealed
              </span>
              <span className="text-[#6b7689]">.cash</span>
            </Link>
            <span className="text-[12px] text-[#4b5568]">/</span>
            <span className="text-[13px] font-medium text-[#8b95a8]">Docs</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/docs/evidence"
              className="hidden text-[13px] font-medium text-[#8b95a8] transition-colors hover:text-[#eaf0f8] sm:inline"
            >
              Evidence
            </Link>
            <Link
              href="/app"
              className="rounded-full bg-gradient-to-br from-[#2dd4bf] to-[#38bdf8] px-3.5 py-1.5 text-[12.5px] font-semibold text-[#04140f] transition-transform duration-150 active:scale-[0.97]"
            >
              Open the app
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px] gap-10 px-5 py-8 lg:px-8 lg:py-14">
        <aside className="sticky top-[68px] hidden h-[calc(100dvh-100px)] w-[248px] shrink-0 overflow-y-auto pb-10 lg:block">
          <DocsSidebar />
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-8 lg:hidden">
            <DocsMobileNav />
          </div>
          <div className="max-w-[720px]">{children}</div>
        </main>

        <aside className="sticky top-[68px] hidden h-fit w-[200px] shrink-0 xl:block">
          <DocsToc />
        </aside>
      </div>
    </div>
  );
}
