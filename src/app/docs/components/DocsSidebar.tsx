'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DOCS_NAV, hrefFor } from '../nav';

/**
 * The persistent left rail. Client-side only because it needs the current
 * pathname to mark the active page; the pages themselves stay server
 * components so their prose ships as HTML.
 */
export function DocsSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Documentation" className="flex flex-col gap-7">
      {DOCS_NAV.map((section) => (
        <div key={section.title}>
          <p className="px-3 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#6b7689]">
            {section.title}
          </p>
          <ul className="mt-2 flex flex-col gap-0.5">
            {section.links.map((link) => {
              const href = hrefFor(link.slug);
              const active = pathname === href;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={`block rounded-lg px-3 py-1.5 text-[13.5px] leading-snug transition-colors duration-150 ${
                      active
                        ? 'bg-white/[0.06] font-medium text-[#eaf0f8]'
                        : 'text-[#8b95a8] hover:bg-white/[0.03] hover:text-[#d8deea]'
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

/** The same nav behind a button on narrow screens, where a 260px rail cannot fit. */
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
        className="flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.03] px-3.5 py-2 text-[13px] font-medium text-[#d8deea]"
      >
        <span aria-hidden>{open ? '×' : '☰'}</span>
        Documentation
      </button>
      {open ? (
        <div
          id="docs-mobile-nav"
          className="mt-3 rounded-2xl border border-white/[0.08] bg-[#0a0c12] p-4"
        >
          <DocsSidebar onNavigate={() => setOpen(false)} />
        </div>
      ) : null}
    </div>
  );
}
