#!/usr/bin/env node
/**
 * WCAG AA contrast checker for BOTH themes (#326, #338).
 *
 * Colours in src are hex literals or CSS variables (--c-*, --ink, ...). The
 * light and dark value of every variable comes from the stylesheets: light
 * from any `--x: #hex` declaration, dark from the overrides inside
 * `:root[data-theme='dark']` blocks in src/app/theme.css.
 *
 * For each theme the script checks that
 *   1. every text colour reaches 4.5:1 on the worst surface it can sit on
 *      (the lightest of that theme's surfaces for dark; the tinted light
 *      surfaces for light). Light text (luminance > 0.55) is assumed to sit on
 *      brand/gradient areas and is skipped; and
 *   2. every rule or inline style that sets both a text colour and a
 *      background is an exact pair of at least 4.5:1.
 * Colours without a resolvable value are ignored.
 *
 * Usage:  node scripts/check-contrast.mjs          (exit 1 on failures)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath instead of URL.pathname: pathname leaves "%20" encoded and can
// double the drive letter on Windows.
const SRC = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src');
const MIN = 4.5;
const LIGHT_SURFACES = [
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

const files = walk(SRC).map((path) => ({
  path,
  // Forward slashes so `rel === 'app/theme.css'` also matches on Windows.
  rel: relative(SRC, path).split(sep).join('/'),
  src: readFileSync(path, 'utf8'),
}));

// ── Variable tables ─────────────────────────────────────────────────────────
const light = new Map();
const dark = new Map();
const HEXDECL = /(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})\s*;/g;
for (const f of files.filter((f) => f.path.endsWith('.css'))) {
  const isTheme = f.rel === 'app/theme.css';
  // Split theme.css into the dark override blocks and everything else.
  const darkBlocks = [];
  let rest = f.src;
  if (isTheme) {
    rest = f.src.replace(/:root\[data-theme=["']dark["']\][^{]*\{[^}]*\}/g, (block) => {
      darkBlocks.push(block);
      return '';
    });
  }
  for (const m of rest.matchAll(HEXDECL)) if (!light.has(m[1])) light.set(m[1], expand(m[2]));
  for (const block of darkBlocks)
    for (const m of block.matchAll(HEXDECL)) dark.set(m[1], expand(m[2]));
}
for (const [k, v] of light) if (!dark.has(k)) dark.set(k, v);

function resolve(token, vars) {
  token = token.trim();
  if (/^#[0-9a-fA-F]{3,6}$/.test(token)) return expand(token);
  const m = token.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*([\s\S]+))?\)$/);
  if (!m) return null;
  if (vars.has(m[1])) return vars.get(m[1]);
  return m[2] ? resolve(m[2], vars) : null;
}

const darkSurfaces = [...dark]
  .filter(
    ([k]) => k.startsWith('--c-bg-') || ['--t-surface', '--t-paper', '--background'].includes(k)
  )
  .map(([, v]) => v);
const DARK_WORST = darkSurfaces.sort((a, b) => luminance(b) - luminance(a))[0];

// Colours chosen at runtime in JS (score badges/rings) are exposed as variables;
// check them as text on every surface of the theme.
const RUNTIME_TEXT_VARS = ['--score-good', '--score-mid', '--score-low', '--score-none'];

// ── Collect colour declarations ─────────────────────────────────────────────
const VAL = String.raw`(var\(\s*--[\w-]+(?:\s*,\s*var\(\s*--[\w-]+\s*\))?(?:\s*,\s*#[0-9a-fA-F]{3,6})?\s*\)|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b)`;
const textRe = new RegExp(String.raw`(?<![-\w])color:\s*['"]?${VAL}`, 'g');
const fgRe = new RegExp(String.raw`(?<![-\w])color:\s*['"]?${VAL}`);
const bgRe = new RegExp(
  String.raw`(?<![-\w])(?:background(?:-color)?|backgroundColor|bg):\s*['"]?${VAL}`
);

const failures = [];
const seen = new Set();
function report(theme, rel, line, msg) {
  const key = `${theme}|${rel}|${line}|${msg}`;
  if (!seen.has(key)) {
    seen.add(key);
    failures.push(`[${theme}] ${rel}:${line}  ${msg}`);
  }
}

for (const [theme, vars] of [
  ['light', light],
  ['dark', dark],
]) {
  const surfaces = theme === 'dark' ? darkSurfaces : LIGHT_SURFACES;
  for (const name of RUNTIME_TEXT_VARS) {
    const c = vars.get(name);
    if (!c) continue;
    const worst = Math.min(...surfaces.map((bg) => ratio(c, bg)));
    if (worst < MIN)
      report(
        theme,
        'app/theme.css',
        0,
        `${name} ${c} → ${worst.toFixed(2)}:1 on its worst surface`
      );
  }
  for (const f of files) {
    if (f.rel === 'app/theme.css') continue;
    // 1. text on the worst surface
    for (const m of f.src.matchAll(textRe)) {
      const c = resolve(m[1], vars);
      if (!c || luminance(c) > 0.55) continue;
      if (theme === 'dark') {
        // Literal dark colours in dark mode are brand/paired colours; only
        // variables are expected to flip, so judge literals via the pair check.
        if (!m[1].startsWith('var(')) continue;
      }
      const worst = Math.min(...surfaces.map((bg) => ratio(c, bg)));
      if (worst < MIN) {
        const line = f.src.slice(0, m.index).split('\n').length;
        report(theme, f.rel, line, `text ${c} → ${worst.toFixed(2)}:1 on its worst surface`);
      }
    }
    // 2. exact pairs inside one rule / style object
    for (const m of f.src.matchAll(/\{([^{}]{0,900})\}/g)) {
      const fg = m[1].match(fgRe);
      const bg = m[1].match(bgRe);
      if (!fg || !bg) continue;
      const a = resolve(fg[1], vars);
      const b = resolve(bg[1], vars);
      if (!a || !b) continue;
      const r = ratio(a, b);
      if (r < MIN) {
        const line = f.src.slice(0, m.index).split('\n').length;
        report(theme, f.rel, line, `${a} on ${b} → ${r.toFixed(2)}:1`);
      }
    }
  }
}

if (failures.length) {
  console.error(`Contrast: ${failures.length} failure(s)\n` + failures.join('\n'));
  process.exit(1);
}
console.log(
  `Contrast: light and dark themes meet WCAG AA (${light.size} variables, darkest-surface check against ${DARK_WORST}).`
);
