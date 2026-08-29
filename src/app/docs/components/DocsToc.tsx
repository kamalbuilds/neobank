'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

type Heading = { id: string; text: string };

/**
 * "On this page", built by reading the rendered article rather than from a
 * hand-kept list. A hand-kept TOC is a second source of truth that silently
 * rots the first time somebody renames a heading, and nothing fails when it
 * does.
 *
 * The active item follows the scroll position: the last heading whose top has
 * passed the reading line is the one you are in.
 */
export function DocsToc() {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [active, setActive] = useState<string>('');

  const pathname = usePathname();

  // Re-read on every route change. The layout persists across navigations, so
  // without the pathname dependency the TOC would keep the first page's
  // headings forever.
  //
  // A MutationObserver rather than a one-shot read: the article can be
  // committed to the DOM after this effect runs, and a single read that loses
  // that race leaves the rail permanently empty with nothing reporting it.
  useEffect(() => {
    const read = () => {
      const article = document.querySelector('article');
      if (!article) return false;
      const found = [...article.querySelectorAll('h2[id]')].map((h) => ({
        id: h.id,
        text: (h as HTMLElement).innerText,
      }));
      if (!found.length) return false;
      setHeadings(found);
      setActive((prev) => (found.some((h) => h.id === prev) ? prev : found[0].id));
      return true;
    };

    setHeadings([]);
    if (read()) return;

    const observer = new MutationObserver(() => {
      if (read()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  useEffect(() => {
    if (!headings.length) return;
    const onScroll = () => {
      // 140px down from the viewport top is the "reading line" - a heading
      // counts as current once it crosses it, not when it merely appears.
      const line = 140;
      let current = headings[0].id;
      for (const h of headings) {
        const el = document.getElementById(h.id);
        if (el && el.getBoundingClientRect().top <= line) current = h.id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [headings]);

  if (headings.length < 2) return null;

  return (
    <nav aria-label="On this page" className="flex flex-col gap-2">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#6b7689]">
        On this page
      </p>
      <ul className="flex flex-col gap-1.5 border-l border-white/[0.08]">
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              aria-current={active === h.id ? 'true' : undefined}
              className={`-ml-px block border-l pl-3 text-[12.5px] leading-snug transition-colors duration-150 ${
                active === h.id
                  ? 'border-[#2dd4bf] text-[#eaf0f8]'
                  : 'border-transparent text-[#7a859c] hover:text-[#d8deea]'
              }`}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
