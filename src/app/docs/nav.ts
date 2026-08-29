/**
 * The documentation's table of contents, as data.
 *
 * It is the single source for the sidebar, the prev/next footer, and the
 * route-coverage test in tests/docs-nav.test.ts - which fails if a page is
 * listed here without a file behind it, or a file exists that nothing links
 * to. A docs site whose sidebar and filesystem disagree is how orphan pages
 * ship.
 */

export type DocLink = {
  /** Route under /docs, without the /docs prefix. '' is the overview. */
  slug: string;
  title: string;
  /** One line shown on the overview's "where to go next" list. */
  summary: string;
};

export type DocSection = {
  title: string;
  links: DocLink[];
};

export const DOCS_NAV: DocSection[] = [
  {
    title: 'Start here',
    links: [
      {
        slug: '',
        title: 'What Sealed is',
        summary: 'A private money account on Starknet, and a straight answer about what it hides.',
      },
      {
        slug: 'quickstart',
        title: 'Quickstart',
        summary: 'From opening the page to your first shielded balance, step by step.',
      },
      {
        slug: 'status',
        title: 'Surface status',
        summary: 'Every surface, marked live, partial, or not built - with the evidence.',
      },
    ],
  },
  {
    title: 'How it works',
    links: [
      {
        slug: 'how-it-works/the-account',
        title: 'The account',
        summary: 'Notes, viewing keys, and why the wallet has to be Ready.',
      },
      {
        slug: 'how-it-works/the-swipe',
        title: 'The swipe',
        summary: 'One transaction that authorizes, converts STRK to USDC, and pays the merchant.',
      },
      {
        slug: 'how-it-works/the-vault',
        title: 'The vault',
        summary: 'A swipe that also opens a lending position, atomically, in the same invoke.',
      },
      {
        slug: 'how-it-works/funding',
        title: 'Funding and exit',
        summary: 'CCTP in from Base, shielded on arrival. Unshield out to a public address.',
      },
    ],
  },
  {
    title: 'Privacy',
    links: [
      {
        slug: 'privacy/who-sees-what',
        title: 'Who sees what',
        summary: 'The five parties that touch a payment, and exactly what each one learns.',
      },
      {
        slug: 'privacy/the-hosted-account',
        title: 'The hosted account',
        summary: 'The custodial exception in a non-custodial product. Read before you swipe.',
      },
      {
        slug: 'privacy/refused-claims',
        title: 'Refused claims',
        summary: 'Twelve sentences this product will not say about itself, and why each one is false.',
      },
    ],
  },
  {
    title: 'Reference',
    links: [
      {
        slug: 'evidence',
        title: 'Evidence',
        summary: 'Every contract and transaction, on chain, checkable without trusting us.',
      },
    ],
  },
];

/** Flat reading order, used for prev/next. */
export const DOCS_ORDER: DocLink[] = DOCS_NAV.flatMap((s) => s.links);

export function hrefFor(slug: string): string {
  return slug ? `/docs/${slug}` : '/docs';
}

export function neighbours(slug: string): { prev: DocLink | null; next: DocLink | null } {
  const i = DOCS_ORDER.findIndex((l) => l.slug === slug);
  if (i === -1) return { prev: null, next: null };
  return {
    prev: i > 0 ? DOCS_ORDER[i - 1] : null,
    next: i < DOCS_ORDER.length - 1 ? DOCS_ORDER[i + 1] : null,
  };
}
