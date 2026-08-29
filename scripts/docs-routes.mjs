/**
 * Every route the app actually has, derived from the filesystem and from
 * nav.ts rather than hand-listed.
 *
 * The deployment checker originally carried a hand-written list: '/', '/app',
 * and the docs routes. That covered two of the eleven product routes, so it
 * could confirm the pages written that day and nothing else - a checker whose
 * coverage matches its author's recent memory. Walking src/app means a route
 * cannot exist without being checked.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const APP_DIR = new URL('../src/app/', import.meta.url).pathname;

/** Route groups (parens) and dynamic segments are not plain static routes. */
function walkRoutes(dir, prefix = '') {
  const routes = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (!statSync(full).isDirectory()) continue;
    if (entry.startsWith('_') || entry.startsWith('.')) continue;
    if (entry === 'api' || entry === 'components') continue;
    // A dynamic segment has no single URL to probe, so it is skipped rather
    // than guessed at.
    if (entry.startsWith('[') || entry.startsWith('(')) continue;

    const routePath = `${prefix}/${entry}`;
    if (readdirSync(full).includes('page.tsx')) routes.push(routePath);
    routes.push(...walkRoutes(full, routePath));
  }
  return routes;
}

export const APP_ROUTES = ['/', ...walkRoutes(APP_DIR)].sort();

// Cross-check: nav.ts is the docs' own source of truth, and every slug in it
// must correspond to a real directory found above. A docs page listed in the
// sidebar but missing from disk would otherwise only surface as a 404 in
// production.
const navSrc = readFileSync(new URL('../src/app/docs/nav.ts', import.meta.url), 'utf8');
const navSlugs = [...navSrc.matchAll(/^\s*slug:\s*'([^']*)',/gm)].map((m) => m[1]);

if (navSlugs.length < 6) {
  throw new Error(
    `parsed only ${navSlugs.length} slugs from nav.ts - its shape changed and this parser needs updating`,
  );
}

export const DOCS_ROUTES = navSlugs.map((slug) => (slug ? `/docs/${slug}` : '/docs'));

const missing = DOCS_ROUTES.filter((r) => !APP_ROUTES.includes(r));
if (missing.length) {
  throw new Error(`nav.ts lists routes with no page.tsx on disk: ${missing.join(', ')}`);
}

/** Everything worth probing: every static route in the app. */
export const ALL_ROUTES = APP_ROUTES;
