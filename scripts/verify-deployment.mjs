/**
 * Checks the DEPLOYED site rather than the repository.
 *
 * A build passing locally proves the code compiles. It does not prove the
 * routes are reachable, or that the demo video a submission depends on is
 * actually served and actually a playable video. Those are separate claims and
 * this checks them against the live origin.
 *
 * Usage:
 *   node scripts/verify-deployment.mjs                     # https://sealed.cash
 *   node scripts/verify-deployment.mjs http://localhost:3000
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DOCS_ROUTES } from './docs-routes.mjs';

const run = promisify(execFile);
const ORIGIN = (process.argv[2] || 'https://sealed.cash').replace(/\/$/, '');

const ROUTES = ['/', '/app', ...DOCS_ROUTES];

let failures = 0;
const fail = (msg) => {
  failures++;
  console.log(`FAIL  ${msg}`);
};
const pass = (msg) => console.log(`PASS  ${msg}`);

console.log(`Checking ${ORIGIN}\n`);

// ─── Routes ──────────────────────────────────────────────────────────────
for (const route of ROUTES) {
  try {
    const res = await fetch(`${ORIGIN}${route}`, { redirect: 'follow' });
    const body = res.ok ? await res.text() : '';
    if (!res.ok) {
      fail(`${route} -> HTTP ${res.status}`);
      continue;
    }
    // A 200 that renders Next's error boundary is still a broken page.
    //
    // Checked via the <title>, not a body substring: Next serializes the 404
    // template into the RSC payload of EVERY page, so a substring check
    // reports a healthy homepage as broken. Verified against the live
    // sealed.cash homepage, which carries that string while rendering fine.
    const title = (body.match(/<title[^>]*>([^<]*)<\/title>/i) || [, ''])[1];
    if (/^404\b/.test(title.trim())) {
      fail(`${route} -> 200 but the page title is "${title.trim()}"`);
      continue;
    }
    pass(`${route} -> ${res.status}${title ? `  "${title.trim().slice(0, 48)}"` : ''}`);
  } catch (err) {
    fail(`${route} -> ${err.message}`);
  }
}

// ─── The demo video ──────────────────────────────────────────────────────
//
// A submission gate depends on this file being served. Checking the repo has
// it proves nothing about what the CDN returns, so this reads the live bytes.
console.log('');
const VIDEO = `${ORIGIN}/demo.mp4`;
try {
  const head = await fetch(VIDEO, { method: 'HEAD' });
  const type = head.headers.get('content-type') || '';
  const length = Number(head.headers.get('content-length') || 0);

  if (!head.ok) fail(`demo.mp4 -> HTTP ${head.status}`);
  else if (!type.startsWith('video/')) fail(`demo.mp4 -> content-type ${type}, not a video`);
  else if (length < 1_000_000) fail(`demo.mp4 -> ${length} bytes, too small to be the render`);
  else pass(`demo.mp4 -> ${type}, ${(length / 1_048_576).toFixed(1)} MB`);

  // Headers can lie. ffprobe reads the container over the network and fails on
  // a truncated or corrupt file, which a content-length check cannot see.
  if (head.ok) {
    try {
      const { stdout } = await run('ffprobe', [
        '-v', 'error',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        VIDEO,
      ]);
      const probe = JSON.parse(stdout);
      const video = probe.streams.find((s) => s.codec_type === 'video');
      const audio = probe.streams.find((s) => s.codec_type === 'audio');
      const duration = Number(probe.format.duration);

      if (!video) fail('demo.mp4 -> no video stream');
      else pass(`demo.mp4 -> ${video.codec_name} ${video.width}x${video.height} @ ${video.r_frame_rate}`);

      if (!audio) fail('demo.mp4 -> no audio stream, narration would be missing');
      else pass(`demo.mp4 -> ${audio.codec_name} ${audio.sample_rate}Hz ${audio.channel_layout}`);

      // A 2-second file is a broken render that still serves a valid 200.
      if (!(duration > 30)) fail(`demo.mp4 -> ${duration}s, too short to be the demo`);
      else pass(`demo.mp4 -> ${duration.toFixed(1)}s`);
    } catch (err) {
      fail(`demo.mp4 -> ffprobe could not decode it: ${String(err.stderr || err.message).trim().split('\n')[0]}`);
    }
  }
} catch (err) {
  fail(`demo.mp4 -> ${err.message}`);
}

console.log(`\n${failures === 0 ? 'DEPLOYMENT VERIFIED' : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
