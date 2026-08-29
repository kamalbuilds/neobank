/**
 * The claims this product will not make about itself.
 *
 * This is a list, not a style guide, because a style guide is advice and a
 * list is testable. `tests/forbidden-claims.test.ts` sweeps every copy module
 * for these substrings and fails the build when one ships.
 *
 * They read as fragments because that is what they are - substrings swept for,
 * not sentences. 'only you can' catches 'only you can see your balance' and
 * every variation of it without anyone having to enumerate the variations.
 *
 * Each entry carries the reason it is false HERE, on this deployment. A banned
 * phrase with no reason beside it becomes cargo cult the first time somebody
 * new reads the list.
 */

export type ForbiddenClaim = {
  /** The substring swept for, lowercase. */
  phrase: string;
  /** Why it is false about Sealed as deployed. */
  reason: string;
};

export const FORBIDDEN_CLAIMS: ForbiddenClaim[] = [
  {
    phrase: 'end-to-end encrypted',
    reason:
      'The hosted card account holds its own server-side viewing key and can read every swipe it settles. There is a third party by construction.',
  },
  {
    phrase: 'e2ee',
    reason: 'Same as end-to-end encrypted, in the abbreviation people actually search for.',
  },
  {
    phrase: 'only you can see',
    reason:
      'False for anything routed through the hosted account, and false for the public deposit and withdrawal legs that need no key at all.',
  },
  {
    phrase: 'zero-knowledge',
    reason:
      'The pool proves things, but every leg that touches an open note has public amounts. The phrase promises more than the protocol delivers.',
  },
  {
    phrase: 'view-only key',
    reason:
      'One key both reads notes and authorises spending them. There is no view-only derivation to hand an accountant, and there will not be one here.',
  },
  {
    phrase: 'watch-only',
    reason: 'Same as view-only: the derivation does not exist on this pool.',
  },
  {
    phrase: 'your address never appears',
    reason:
      'It appears on the deposit, and on any unshield to a public address. The narrow true claim is that it is not the transaction sender on a private operation.',
  },
  {
    phrase: 'amounts are private',
    reason:
      'False for deposits, withdrawals and the pool fee, all of which are ordinary public transfers. Claim identity privacy; never claim amount privacy for the public legs.',
  },
  {
    phrase: 'untraceable',
    reason:
      'Traceability here is a function of the anonymity set, which on a testnet pool is small. An unusual amount narrows it to one account.',
  },
  {
    phrase: 'fully private',
    reason:
      'No configuration of this product is fully private. The word deletes the entire distinction the documentation exists to draw.',
  },
  {
    phrase: 'bank account',
    reason:
      'Sealed is not a licensed bank, holds no deposits, and offers no protection. "Money account" is the honest noun.',
  },
  {
    phrase: 'guaranteed yield',
    reason:
      'The vault is a Sepolia demonstration holding test money. There is no rate, and nothing here generates one.',
  },
];

/** Just the substrings, for the sweep. */
export const FORBIDDEN_PHRASES: string[] = FORBIDDEN_CLAIMS.map((c) => c.phrase);

/**
 * Returns every forbidden phrase present in the given copy. Case-insensitive,
 * because 'Fully Private' in a heading is the same lie as 'fully private' in a
 * paragraph.
 */
export function findForbiddenClaims(copy: string): string[] {
  const haystack = copy.toLowerCase();
  return FORBIDDEN_PHRASES.filter((phrase) => haystack.includes(phrase));
}
