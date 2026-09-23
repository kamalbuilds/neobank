'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DOCS_NAV, hrefFor } from '../nav';

/**
 * The persistent left rail. Client-side only because it needs the current
 * pathname to mark the active page; the pages themselves stay server
 * components so their prose ships as HTML.
 *
 * One continuous hairline runs down the rail and the active page puts a seal
 * tick on it. That is the only accent in the navigation: a reader should be
 * able to find where they are without a colour ever competing with the page.
 */
export function DocsSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Documentation" className="flex flex-col gap-8">
      {DOCS_NAV.map((section) => (
        <div key={section.title}>
          <p className="figure pl-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">
            {section.title}
          </p>
          <ul className="mt-2.5 flex flex-col">
            {section.links.map((link) => {
              const href = hrefFor(link.slug);
              const active = pathname === href;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={`block border-l-2 py-1.5 pl-3 pr-2 text-[14px] leading-snug transition-[color,background-color,border-color] duration-150 ${
                      active
                        ? 'border-l-[color:var(--seal)] bg-white/[0.04] font-bold text-ink'
                        : 'border-l-[color:var(--line)] text-ink/70 hover:border-l-[color:var(--line-strong)] hover:bg-white/[0.02] hover:text-ink'
                    }`}
                  >
                    {link.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** The same nav behind a button on narrow screens, where a 236px rail cannot fit. */
export function DocsMobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Route change closes it; without this the panel survives navigation and
  // covers the page you just asked for.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="docs-mobile-nav"
        className="flex items-center gap-2 rounded-[4px] border border-[color:var(--line-strong)] bg-white/[0.03] px-3.5 py-2 text-[14px] font-bold text-ink transition-transform duration-150 active:scale-[0.97]"
      >
        <span aria-hidden="true" className="figure">
          {open ? '×' : '≡'}
        </span>
        Documentation
      </button>
      {open ? (
        <div
          id="docs-mobile-nav"
          className="mt-3 rounded-[4px] border border-[color:var(--line)] bg-chrome-2 p-4"
        >
          <DocsSidebar onNavigate={() => setOpen(false)} />
        </div>
      ) : null}
    </div>
  );
}
