import { expect } from 'vitest';
import { configureAxe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';

expect.extend(matchers);

/**
 * axe-core runner for component/page tests (#324).
 *
 * - Runs the WCAG 2.0/2.1 A + AA rules plus axe's best practices
 *   (this includes heading-order, label, aria-*, button-name, link-name).
 * - `color-contrast` is disabled because jsdom has no layout engine, so axe
 *   cannot compute it. Contrast is covered by scripts/check-contrast.mjs and
 *   by Lighthouse in the browser (docs: accessibility-audit.md).
 * - `region` is disabled for isolated fragments (they have no <body> landmarks);
 *   it is enforced in the real browser audit instead.
 */
const axe = configureAxe({
  rules: {
    'color-contrast': { enabled: false },
    region: { enabled: false },
  },
  runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
});

export async function expectNoAxeViolations(container) {
  const results = await axe(container);
  expect(results).toHaveNoViolations();
}
