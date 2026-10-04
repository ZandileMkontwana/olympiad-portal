#!/usr/bin/env node
/**
 * Lighthouse accessibility audit for every page (#323, #331).
 *
 * Setup (one-off, not saved in package.json so CI stays light):
 *   npm i -D lighthouse chrome-launcher
 *
 * Run against a production build:
 *   npm run build && npm start            # terminal 1
 *   node scripts/lighthouse-audit.mjs     # terminal 2
 *
 * Pages behind login need your Clerk session cookies. Sign in in the browser,
 * copy the Cookie request header from DevTools > Network, then:
 *   LH_COOKIE="__session=...; __client_uat=..." node scripts/lighthouse-audit.mjs
 *
 * Replace the [id] placeholders below with real ids from your database.
 * Output: a markdown table (paste into documents/docs/accessibility-audit.md)
 * and lighthouse-a11y-report.json. Exit code 1 if any page scores under 90.
 */
import { writeFileSync } from 'node:fs';

const BASE = process.env.LH_BASE_URL || 'http://localhost:3000';
const COOKIE = process.env.LH_COOKIE || '';
const THRESHOLD = 90;
const ROUND = process.env.LH_ROUND_ID || 'ROUND_ID';

const PAGES = [
  ['Landing', '/'],
  ['Login', '/login'],
  ['Register', '/register'],
  ['Archive (public)', '/archive'],
  ['Organiser dashboard', '/organiser'],
  ['Organiser marking', '/organiser/marking'],
  ['Organiser remarks', '/organiser/remarks'],
  ['Organiser replay', '/organiser/replay'],
  ['Organiser archive', '/organiser/archive'],
  ['New round', '/rounds/new'],
  ['Round papers', `/rounds/${ROUND}/papers`],
  ['Round notifications', `/rounds/${ROUND}/notifications`],
  ['Round standings', `/rounds/${ROUND}/standings`],
  ['Educator dashboard', '/educator'],
  ['Educator school', '/educator/school'],
  ['Educator round view', `/educator/round_view?roundId=${ROUND}`],
  ['Educator submit', `/educator/submit?roundId=${ROUND}`],
  ['Educator archive', '/educator/archive'],
  ['Student dashboard', '/student'],
  ['Student result', `/student/result?roundId=${ROUND}`],
  ['Student sitting', `/student/sit?roundId=${ROUND}`],
];

const { default: lighthouse } = await import('lighthouse');
const chromeLauncher = await import('chrome-launcher');

const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new', '--no-sandbox'] });
const rows = [];
const report = {};

for (const [name, path] of PAGES) {
  const result = await lighthouse(`${BASE}${path}`, {
    port: chrome.port,
    onlyCategories: ['accessibility'],
    output: 'json',
    extraHeaders: COOKIE ? { Cookie: COOKIE } : undefined,
    formFactor: 'mobile',
  });
  const lhr = result.lhr;
  const score = Math.round((lhr.categories.accessibility.score ?? 0) * 100);
  const failed = Object.values(lhr.audits)
    .filter((a) => a.score === 0)
    .map((a) => a.id);
  rows.push({ name, path, score, failed });
  report[path] = { score, failed };
  console.log(
    `${score >= THRESHOLD ? 'PASS' : 'FAIL'} ${String(score).padStart(3)}  ${path}  ${failed.join(', ')}`
  );
}
await chrome.kill();

const md = [
  '| Page | Path | Score | Failing audits |',
  '|------|------|-------|----------------|',
  ...rows.map((r) => `| ${r.name} | \`${r.path}\` | ${r.score} | ${r.failed.join(', ') || '—'} |`),
].join('\n');
console.log('\n' + md);
writeFileSync('lighthouse-a11y-report.json', JSON.stringify(report, null, 2));
process.exit(rows.some((r) => r.score < THRESHOLD) ? 1 : 0);
