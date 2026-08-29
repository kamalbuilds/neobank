#!/usr/bin/env node
/* make-seal.mjs
 *
 * Generates the Sealed avatar as an actual wax seal.
 *
 * The previous mark was a perfect circle with a centred bold "S" and a
 * teal-to-blue gradient, which is the exact template every token logo uses:
 * nothing about it said "seal", and at timeline size it read as a generic
 * coin. The product is called Sealed, so the mark renders the noun. What
 * makes wax read as wax is the silhouette, not the colour, so the palette is
 * unchanged and the form does the work:
 *
 *   - an irregular pressed edge, radius wobbling around the circle, because a
 *     perfect circle is a coin and wax never lands perfectly round
 *   - the monogram debossed into the surface (dark inner shadow above, light
 *     catch below) rather than sitting on top of it
 *   - a matte body lit from the upper left, with the rim catching light only
 *     where it faces the source
 *
 * Deterministic: the wobble comes from a fixed seed, so re-running produces
 * the identical file rather than a slightly different logo each time.
 */

import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SIZE = 400;
const CX = SIZE / 2;
const CY = SIZE / 2;

// Small deterministic PRNG so the silhouette never drifts between runs.
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Closed blob through N points at wobbling radii, joined with a Catmull-Rom
 * spline converted to cubic beziers so the outline stays smooth — wax has no
 * corners, it flows and sets.
 */
function waxPath(seed, baseR, wobble, points = 22) {
  const rnd = mulberry32(seed);
  const pts = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    const r = baseR * (1 + (rnd() - 0.5) * 2 * wobble);
    pts.push([CX + Math.cos(a) * r, CY + Math.sin(a) * r]);
  }
  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < points; i++) {
    const p0 = pts[(i - 1 + points) % points];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % points];
    const p3 = pts[(i + 2) % points];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0].toFixed(2)} ${c1[1].toFixed(2)}, ${c2[0].toFixed(2)} ${c2[1].toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d + " Z";
}

const outer = waxPath(20260830, 176, 0.035);
// The pressed inner face sits slightly inset and wobbles on its own seed, so
// the ring of wax squeezed out around the stamp varies in width the way a real
// impression does.
const inner = waxPath(77345, 138, 0.03);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <defs>
    <radialGradient id="wax" cx="34%" cy="28%" r="82%">
      <stop offset="0%" stop-color="#5fe3d0"/>
      <stop offset="46%" stop-color="#2dd4bf"/>
      <stop offset="100%" stop-color="#0f5f6d"/>
    </radialGradient>
    <radialGradient id="face" cx="36%" cy="30%" r="80%">
      <stop offset="0%" stop-color="#43d8c8"/>
      <stop offset="100%" stop-color="#17808c"/>
    </radialGradient>
    <filter id="drop" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="7" stdDeviation="11" flood-color="#000" flood-opacity="0.62"/>
    </filter>
    <!-- Deboss: dark shadow cast down-right inside the letter, light catch
         up-left, which is what reads as "pressed in" rather than "sitting on". -->
    <filter id="deboss" x="-40%" y="-40%" width="180%" height="180%">
      <feOffset in="SourceAlpha" dx="0" dy="3" result="do"/>
      <feGaussianBlur in="do" stdDeviation="1.5" result="db"/>
      <feFlood flood-color="#06373b" flood-opacity="0.95" result="dc"/>
      <feComposite in="dc" in2="db" operator="in" result="ds"/>
      <feOffset in="SourceAlpha" dx="0" dy="-2.4" result="lo"/>
      <feGaussianBlur in="lo" stdDeviation="1.3" result="lb"/>
      <feFlood flood-color="#b6fbef" flood-opacity="0.62" result="lc"/>
      <feComposite in="lc" in2="lb" operator="in" result="ls"/>
      <feMerge><feMergeNode in="ls"/><feMergeNode in="ds"/></feMerge>
    </filter>
  </defs>

  <rect width="${SIZE}" height="${SIZE}" fill="#0B0B0D"/>

  <g filter="url(#drop)">
    <path d="${outer}" fill="url(#wax)"/>
    <!-- Rim light only on the lit side; a stroke all the way round would
         flatten it back into a coin. -->
    <path d="${outer}" fill="none" stroke="#7ff0e0" stroke-opacity="0.34" stroke-width="2.4"
          stroke-dasharray="300 720" stroke-dashoffset="60"/>
    <path d="${inner}" fill="url(#face)"/>
    <path d="${inner}" fill="none" stroke="#0d5e68" stroke-opacity="0.5" stroke-width="2"/>
  </g>

  <g filter="url(#deboss)">
    <text x="${CX}" y="${CY + 2}" text-anchor="middle" dominant-baseline="central"
          font-family="Georgia, 'Times New Roman', serif" font-size="184" font-weight="700"
          fill="#07414a">S</text>
  </g>
</svg>`;

const svgPath = path.join(DIR, "avatar.svg");
writeFileSync(svgPath, svg);
execFileSync("rsvg-convert", ["-w", String(SIZE), "-h", String(SIZE), svgPath, "-o", path.join(DIR, "avatar.png")]);
console.log("wrote avatar.svg + avatar.png");
