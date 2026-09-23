'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

type Heading = { id: string; text: string };

/** Where the reading line sits: a heading is current once its top crosses this. */
const READING_LINE = 140;

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

  // Scroll-spy on an IntersectionObserver rather than a scroll listener. The
  // browser wakes this up only when a heading crosses the reading line rather
  // than on every frame the user scrolls. The rule itself is unchanged:
  // recompute from live rects and take the last heading at or above the line,
  // which keeps the active item correct scrolling up as well as down.
  //
  // The bottom margin is deliberately enormous. With a band that ended at the
  // viewport bottom, a heading that jumped from below the fold to above the
  // reading line in one step - an anchor click, Cmd+End, a flick - was
  // not-intersecting before and not-intersecting after, so no callback fired
  // and the rail kept the previous section highlighted. Measured: scrolling
  // 1200 to 3700 left "Transactions" lit while the reader was in "Contracts".
  // Extending the root below the page makes "below the reading line" the
  // intersecting state, so every crossing flips it and fires no matter how far
  // the jump.
  useEffect(() => {
    if (!headings.length) return;
    const els = headings
      .map((h) => document.getElementById(h.id))
      .filter((el): el is HTMLElement => el !== null);
    if (!els.length) return;

    const recompute = () => {
      let current = els[0].id;
      for (const el of els) {
        if (el.getBoundingClientRect().top <= READING_LINE) current = el.id;
      }
      setActive(current);
    };

    const observer = new IntersectionObserver(recompute, {
      rootMargin: `-${READING_LINE}px 0px 100000px 0px`,
      threshold: 0,
    });
    for (const el of els) observer.observe(el);
    recompute();

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length < 2) return null;

  return (
    <nav aria-label="On this page" className="flex flex-col gap-3">
      <p className="figure pl-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">
        On this page
      </p>
      <ul className="flex flex-col">
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              data-toc-item={h.id}
              aria-current={active === h.id ? 'true' : undefined}
              className={`block border-l-2 py-1.5 pl-3 pr-2 text-[14px] leading-snug transition-[color,border-color] duration-150 ${
                active === h.id
                  ? 'border-l-[color:var(--seal)] font-bold text-ink'
                  : 'border-l-[color:var(--line)] text-ink/70 hover:border-l-[color:var(--line-strong)] hover:text-ink'
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
