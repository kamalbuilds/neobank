import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DOCS_NAV, DOCS_ORDER, hrefFor, neighbours } from '../src/app/docs/nav';
import { FORBIDDEN_CLAIMS } from '../src/lib/forbidden-claims';

/**
 * A docs sidebar and the filesystem drifting apart is how a 404 ships in a
 * nav and an orphan page ships with nothing linking to it. Both directions
 * are checked here.
 */

const DOCS_DIR = join(process.cwd(), 'src', 'app', 'docs');

describe('every listed page exists', () => {
  it('lists a non-trivial number of pages', () => {
    expect(DOCS_ORDER.length).toBeGreaterThan(5);
  });

  it.each(DOCS_ORDER.map((l) => [l.slug || '(overview)', l.slug] as const))(
    '%s has a page.tsx',
    (_name, slug) => {
      expect(existsSync(join(DOCS_DIR, slug, 'page.tsx'))).toBe(true);
    },
  );
});

describe('the check can fail', () => {
  it('reports missing for a slug with no file', () => {
    expect(existsSync(join(DOCS_DIR, 'privacy/not-a-real-page', 'page.tsx'))).toBe(false);
  });
});

describe('nav shape', () => {
  it('has no duplicate slugs', () => {
    const slugs = DOCS_ORDER.map((l) => l.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('has exactly one overview at the empty slug', () => {
    expect(DOCS_ORDER.filter((l) => l.slug === '').length).toBe(1);
  });

  it('gives every page a title and a summary', () => {
    for (const link of DOCS_ORDER) {
      expect(link.title.length).toBeGreaterThan(2);
      expect(link.summary.length).toBeGreaterThan(20);
    }
  });

  it('builds hrefs under /docs', () => {
    expect(hrefFor('')).toBe('/docs');
    expect(hrefFor('privacy/who-sees-what')).toBe('/docs/privacy/who-sees-what');
  });

  it('groups every page into a section', () => {
    const inSections = DOCS_NAV.flatMap((s) => s.links).length;
    expect(inSections).toBe(DOCS_ORDER.length);
  });
});

describe('reading order', () => {
  it('gives the first page no previous and the last no next', () => {
    expect(neighbours(DOCS_ORDER[0].slug).prev).toBeNull();
    expect(neighbours(DOCS_ORDER[DOCS_ORDER.length - 1].slug).next).toBeNull();
  });

  it('links consecutive pages to each other', () => {
    for (let i = 0; i < DOCS_ORDER.length - 1; i++) {
      expect(neighbours(DOCS_ORDER[i].slug).next?.slug).toBe(DOCS_ORDER[i + 1].slug);
      expect(neighbours(DOCS_ORDER[i + 1].slug).prev?.slug).toBe(DOCS_ORDER[i].slug);
    }
  });

  it('returns nothing for an unknown slug', () => {
    expect(neighbours('nope/nope')).toEqual({ prev: null, next: null });
  });
});

describe('no prose hardcodes the size of a generated list', () => {
  /**
   * "Nine sentences" shipped in the sidebar while the list held twelve. The
   * refused-claims page renders from FORBIDDEN_CLAIMS, so any count written
   * beside it in prose is a second source of truth with nothing checking it.
   *
   * Scoped to counts of THAT list rather than every number word, because a
   * blanket ban flags "one transaction" and teaches people to skip the rule.
   */
  const NUMBER_WORDS: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
    nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  };

  /** Counts stated ahead of a word meaning "a refused claim". */
  function statedClaimCount(copy: string): number | null {
    const m = copy
      .toLowerCase()
      .match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen)\s+(sentences|phrases|claims|words)\b/);
    if (!m) return null;
    return NUMBER_WORDS[m[1]] ?? Number(m[1]);
  }

  it('detects a stated count', () => {
    expect(statedClaimCount('Nine sentences this product will not say')).toBe(9);
    expect(statedClaimCount('the 12 phrases we refuse')).toBe(12);
  });

  it('ignores ordinary prose', () => {
    expect(statedClaimCount('One transaction that authorizes and pays')).toBeNull();
    expect(statedClaimCount('The five parties that touch a payment')).toBeNull();
  });

  const REFUSED_SOURCES: [string, string][] = [
    ...DOCS_ORDER.filter((l) => l.slug === 'privacy/refused-claims').map(
      (l) => ['nav summary', l.summary] as [string, string],
    ),
    [
      'refused-claims page',
      readFileSync(join(DOCS_DIR, 'privacy', 'refused-claims', 'page.tsx'), 'utf8'),
    ],
  ];

  it.each(REFUSED_SOURCES)('%s states no stale count', (_where, copy) => {
    const stated = statedClaimCount(copy);
    if (stated !== null) expect(stated).toBe(FORBIDDEN_CLAIMS.length);
  });
});
