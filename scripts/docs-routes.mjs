/**
 * The docs routes, read out of src/app/docs/nav.ts rather than restated.
 *
 * A second hand-kept list would let the deployment checker pass while a page
 * it never knew about was 404ing, which is exactly the failure the checker
 * exists to catch.
 *
 * nav.ts is TypeScript, so the slugs are parsed out instead of imported.
 * Node cannot require a .ts file here, and adding a build step to a
 * verification script makes the script another thing that can break.
 */
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/app/docs/nav.ts', import.meta.url), 'utf8');

const slugs = [...src.matchAll(/^\s*slug:\s*'([^']*)',/gm)].map((m) => m[1]);

if (slugs.length < 6) {
  throw new Error(
    `docs-routes.mjs parsed only ${slugs.length} slugs from nav.ts - the file's shape changed and this parser needs updating`,
  );
}

export const DOCS_ROUTES = slugs.map((slug) => (slug ? `/docs/${slug}` : '/docs'));
