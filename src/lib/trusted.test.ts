/**
 * OWNER: teammate D, alongside api/_trusted.ts.  Run with:  npm test
 *
 * The allowlist decides what may appear on screen as evidence, so the matching
 * has to be exact. A near-miss that passes is a spoofed source cited under
 * this product's name.
 */

import { describe, expect, it } from 'vitest';
import { TRUSTED_DOMAINS, isTrustedSource } from '../../api/_trusted';

describe('isTrustedSource', () => {
  it('accepts a bare trusted domain, which is how Gemini reports the publisher', () => {
    expect(isTrustedSource('unesco.org', 'https://vertexaisearch.google.com/redirect/abc')).toBe(
      true,
    );
    expect(isTrustedSource('wikipedia.org', undefined)).toBe(true);
  });

  it('accepts a subdomain of a trusted domain', () => {
    expect(isTrustedSource('whc.unesco.org')).toBe(true);
    expect(isTrustedSource('en.wikipedia.org')).toBe(true);
  });

  it('accepts a full URL on a trusted host', () => {
    expect(isTrustedSource(undefined, 'https://whc.unesco.org/en/list/1293')).toBe(true);
  });

  it('rejects a domain that only contains a trusted name', () => {
    // The dot prefix is what stops these.
    expect(isTrustedSource('notunesco.org')).toBe(false);
    expect(isTrustedSource('unesco.org.example.com')).toBe(false);
    expect(isTrustedSource(undefined, 'https://fake-wikipedia.org/article')).toBe(false);
  });

  it('rejects anything not on the list', () => {
    expect(isTrustedSource('tripadvisor.com')).toBe(false);
    expect(isTrustedSource('some-travel-blog.net')).toBe(false);
    expect(isTrustedSource('reddit.com', 'https://reddit.com/r/saudiarabia')).toBe(false);
  });

  it('rejects an empty citation', () => {
    expect(isTrustedSource(undefined, undefined)).toBe(false);
    expect(isTrustedSource('', '')).toBe(false);
  });

  it('is case insensitive', () => {
    expect(isTrustedSource('UNESCO.ORG')).toBe(true);
  });

  it('keeps the list free of duplicates and of empty entries', () => {
    expect(new Set(TRUSTED_DOMAINS).size).toBe(TRUSTED_DOMAINS.length);
    expect(TRUSTED_DOMAINS.every((d) => d.trim() !== '' && !d.startsWith('.'))).toBe(true);
  });
});
