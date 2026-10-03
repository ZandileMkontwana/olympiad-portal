import { describe, it, expect, afterEach } from 'vitest';
const {
  BRAND,
  frontendUrl,
  ctaButton,
  brandEmailHtml,
  formatDateTime,
} = require('./emailTemplates');

afterEach(() => {
  delete process.env.FRONTEND_URL;
});

describe('frontendUrl', () => {
  it('returns null when FRONTEND_URL is not configured', () => {
    delete process.env.FRONTEND_URL;
    expect(frontendUrl('/login')).toBeNull();
  });

  it('joins the configured base with the path and strips trailing slashes', () => {
    process.env.FRONTEND_URL = 'https://portal.example.com/';
    expect(frontendUrl('/login')).toBe('https://portal.example.com/login');
  });
});

describe('brandEmailHtml', () => {
  it('wraps the heading and body in the branded card with the wordmark', () => {
    const html = brandEmailHtml({ heading: 'Hello', bodyHtml: '<p>Body copy</p>' });

    expect(html).toContain(BRAND.name);
    expect(html).toContain('Hello');
    expect(html).toContain('<p>Body copy</p>');
    // Table-based inline-styled layout: email clients strip <style> blocks.
    expect(html).toContain('role="presentation"');
    expect(html).toContain(`background:${BRAND.deep}`);
    expect(html).toContain('automated message');
  });

  it('embeds the logo only when FRONTEND_URL is configured', () => {
    delete process.env.FRONTEND_URL;
    const withoutLogo = brandEmailHtml({ heading: 'H', bodyHtml: '<p>b</p>' });
    expect(withoutLogo).not.toContain('<img');

    process.env.FRONTEND_URL = 'https://portal.example.com';
    const withLogo = brandEmailHtml({ heading: 'H', bodyHtml: '<p>b</p>' });
    expect(withLogo).toContain('https://portal.example.com/tree-mark.png');
  });

  it('renders the call-to-action button when provided', () => {
    const html = brandEmailHtml({
      heading: 'H',
      bodyHtml: '<p>b</p>',
      cta: ctaButton('View results', 'https://portal.example.com/login'),
    });

    expect(html).toContain('href="https://portal.example.com/login"');
    expect(html).toContain('View results');
  });
});

describe('formatDateTime', () => {
  it('renders a UTC timestamp in South African local time', () => {
    expect(formatDateTime('2026-01-01T10:00:00.000Z')).toBe('01 Jan 2026, 12:00 SAST');
  });

  it('accepts Date objects as well as ISO strings', () => {
    expect(formatDateTime(new Date('2026-10-03T09:41:00.000Z'))).toBe('03 Oct 2026, 11:41 SAST');
  });

  it('falls back to the raw value when the input is not a valid date', () => {
    expect(formatDateTime('not-a-date')).toBe('not-a-date');
  });
});
