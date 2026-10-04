#!/usr/bin/env node
/**
 * WCAG AA contrast checker (#326).
 *
 * 1. Every hex colour used as a text `color:` in src must reach 4.5:1 against
 *    the lightest-tinted surface it can sit on (worst case of the app's light
 *    backgrounds). Light text (luminance > 0.55) is assumed to sit on the dark
 *    hero/gradient areas and is skipped.
 * 2. Every rule or inline style that sets BOTH a colour and a background is
 *    checked as an exact pair.
 *
 * Usage: node scripts/check-contrast.mjs        (exit code 1 on failures)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SRC = join(__dirname, '..', 'src');
const LIGHT_BGS = [
  '#ffffff',
  '#faf7fd',
  '#f0edff',
  '#f7f8fc',
  '#f5effa',
  '#f7f6ff',
  '#e9f8f1',
  '#fff5dd',
  '#eaf4ff',
  '#f0fdf4',
  '#f7f5fb',
  '#fef2f2',
];

const expand = (h) =>
  (h.length === 4 ? '#' + [...h.slice(1)].map((c) => c + c).join('') : h).toLowerCase();
const channel = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return /\.(js|jsx|css)$/.test(name) && !/\.test\./.test(name) ? [p] : [];
  });
}

const failures = [];
const HEX = '(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})\\b';
const textColour = new RegExp(`(?<![-\\w])color:\\s*['"]?${HEX}`, 'g');

for (const file of walk(SRC)) {
  const src = readFileSync(file, 'utf8');
  const rel = relative(SRC, file);

  for (const m of src.matchAll(textColour)) {
    const c = expand(m[1]);
    if (luminance(c) > 0.55) continue;
    const worst = Math.min(...LIGHT_BGS.map((bg) => ratio(c, bg)));
    if (worst < 4.5) {
      const line = src.slice(0, m.index).split('\n').length;
      failures.push(`${rel}:${line}  text ${c} → ${worst.toFixed(2)}:1 on its worst light surface`);
    }
  }

  const blocks = /\{([^{}]{0,700})\}/g;
  for (const m of src.matchAll(blocks)) {
    const fg = m[1].match(new RegExp(`(?<![-\\w])color:\\s*['"]?${HEX}`));
    const bg = m[1].match(new RegExp(`background(?:Color)?:\\s*['"]?${HEX}`));
    if (!fg || !bg) continue;
    const r = ratio(expand(fg[1]), expand(bg[1]));
    if (r < 4.5) {
      const line = src.slice(0, m.index).split('\n').length;
      failures.push(`${rel}:${line}  ${expand(fg[1])} on ${expand(bg[1])} → ${r.toFixed(2)}:1`);
    }
  }
}

if (failures.length) {
  console.error(`Contrast: ${failures.length} failure(s)\n` + failures.join('\n'));
  process.exit(1);
}
console.log('Contrast: all text colours meet WCAG AA (4.5:1).');
