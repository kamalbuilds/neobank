import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  FORBIDDEN_CLAIMS,
  FORBIDDEN_PHRASES,
  findForbiddenClaims,
} from '../src/lib/forbidden-claims';

/**
 * The refused-claims list is only worth publishing if something enforces it.
 * A list nobody checks is a style guide, and style guides lose to a deadline.
 *
 * This sweeps every shipped copy surface - the docs, the landing page and the
 * marketing components - for the banned substrings.
 */

const COPY_DIRS = [
  'src/app/docs',
  'src/app/components/marketing',
];

const COPY_FILES = ['src/app/page.tsx'];

function collectFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...collectFiles(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * The docs necessarily QUOTE the banned phrases in order to refuse them, so
 * the sweep has to skip the two files whose subject is the list itself.
 * Anything wider than this pair would be a hole big enough to hide real copy
 * in.
 */
const QUOTING_FILES = [
  join('src', 'lib', 'forbidden-claims.ts'),
  join('src', 'app', 'docs', 'privacy', 'refused-claims', 'page.tsx'),
];

const files = [...COPY_DIRS.flatMap(collectFiles), ...COPY_FILES].filter(
  (f) => !QUOTING_FILES.some((q) => f.endsWith(q)),
);

describe('the sweep can actually fail', () => {
  it('flags a forbidden phrase in a string', () => {
    expect(findForbiddenClaims('Sealed is fully private, we promise')).toEqual(['fully private']);
  });

  it('is case-insensitive', () => {
    expect(findForbiddenClaims('A Bank Account on Starknet')).toContain('bank account');
  });

  it('passes clean copy', () => {
    expect(findForbiddenClaims('A money account the public ledger cannot read.')).toEqual([]);
  });
});

describe('shipped copy', () => {
  it('sweeps a non-empty set of files', () => {
    // Without this the suite below passes vacuously the day a path changes.
    expect(files.length).toBeGreaterThan(8);
  });

  it.each(files)('%s makes no refused claim', (file) => {
    const found = findForbiddenClaims(readFileSync(file, 'utf8'));
    expect(found, `${file} contains refused claim(s): ${found.join(', ')}`).toEqual([]);
  });
});

describe('the list itself', () => {
  it('gives a reason for every phrase', () => {
    for (const claim of FORBIDDEN_CLAIMS) {
      expect(claim.reason.length, `${claim.phrase} has no reason`).toBeGreaterThan(40);
    }
  });

  it('has no duplicate phrases', () => {
    expect(new Set(FORBIDDEN_PHRASES).size).toBe(FORBIDDEN_PHRASES.length);
  });

  it('stores phrases lowercase, since the sweep lowercases the haystack', () => {
    for (const phrase of FORBIDDEN_PHRASES) {
      expect(phrase).toBe(phrase.toLowerCase());
    }
  });
});
