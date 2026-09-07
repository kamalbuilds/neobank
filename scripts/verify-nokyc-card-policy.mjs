#!/usr/bin/env node
// Re-verify the quotes docs/research/CARD_LEG_NOBODY_CARDS.md rests on.
//
// The teardown's conclusion (no-KYC card programs freeze privacy-pool-sourced deposits)
// is only as good as two strings still being in the bundle nobody.cards serves. Vendors
// edit terms quietly, so this refetches and re-greps instead of trusting the doc.
//
// Exit 0: both found, conclusion still holds.
// Exit 1: a string is gone, or the site moved. Re-read the live policy before citing the doc.

const ORIGIN = 'https://www.nobody.cards';

// Each probe is a claim in the doc, paired with the literal it cites.
const PROBES = [
  {
    claim: 'freeze state exists in the card state machine',
    needle: 'FROZEN_KYC_REQUESTED',
  },
  {
    claim: 'privacy-pool-sourced funds are a zero-tolerance freeze category',
    needle: 'Mixing Services or Obfuscation Tools',
  },
  {
    claim: 'the freeze reaches through a bridge hop',
    needle: 'indirect usage through intermediary platforms',
  },
  {
    claim: 'no-KYC is a legal threshold, not cryptography',
    needle: 'without full KYC requirements',
  },
];

async function text(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

async function main() {
  // The Vite entry filename is content-hashed, so discover it rather than pinning it.
  const login = await text(`${ORIGIN}/login`);
  const entry = login.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0];
  if (!entry) throw new Error('no /assets/index-*.js in /login: the app was replaced, re-read it by hand');

  const app = await text(ORIGIN + entry);
  const chunks = [...new Set(app.match(/assets\/[A-Za-z0-9._-]+\.js/g) ?? [])];
  console.log(`entry ${entry}, ${chunks.length} chunks`);

  // The landing page carries the FAQ; the chunks carry the terms and card states.
  const parts = [login, app, await text(`${ORIGIN}/`)];
  for (const c of chunks) {
    parts.push(await text(`${ORIGIN}/${c}`).catch(() => ''));
  }
  const haystack = parts.join('\n');
  if (haystack.length < 500_000) throw new Error(`only ${haystack.length} bytes fetched, a miss would be meaningless`);

  let missing = 0;
  for (const { claim, needle } of PROBES) {
    const hit = haystack.includes(needle);
    if (!hit) missing++;
    console.log(`${hit ? 'ok  ' : 'GONE'}  ${claim}\n        "${needle}"`);
  }

  if (missing) {
    console.error(`\n${missing} of ${PROBES.length} quotes are gone. Their policy may have changed.`);
    console.error('Re-read the live terms before citing docs/research/CARD_LEG_NOBODY_CARDS.md.');
    process.exit(1);
  }
  console.log(`\nAll ${PROBES.length} quotes still live. B2 stays closed.`);
}

main().catch((e) => {
  console.error(`failed: ${e.message}`);
  process.exit(1);
});
