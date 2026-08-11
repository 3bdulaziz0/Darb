/**
 * OWNER: teammate D (curation) with teammate B.
 *
 * The domains a web-sourced answer may cite.
 *
 * ── Why an allowlist and not just "search the web" ─────────────────────────
 * The library is curated so that every claim has a source someone chose. Once
 * answers can come from a live search, that choice moves here: this list is
 * now part of the product's editorial standard, not a technical detail.
 *
 * A search result from a travel blog, an SEO farm, or a forum is not evidence.
 * If the answer cannot be grounded in one of these, we say we do not know —
 * which is the same thing the app has always done, just one step later.
 *
 * Adding a domain is an editorial decision. Ask whether you would be happy to
 * see it cited on screen, under this product's name, in front of a judge.
 */

export const TRUSTED_DOMAINS: string[] = [
  // Intergovernmental
  'unesco.org',
  'whc.unesco.org',

  // Saudi official and state bodies
  'moc.gov.sa', // Ministry of Culture
  'mot.gov.sa', // Ministry of Tourism
  'my.gov.sa',
  'spa.gov.sa', // Saudi Press Agency
  'rcu.gov.sa', // Royal Commission for AlUla
  'diriyah.sa',
  'diriyahgate.sa',
  'saudiheritage.gov.sa',
  'scth.gov.sa',
  'vision2030.gov.sa',
  'gov.sa',

  // Official tourism and reference
  'visitsaudi.com',
  'saudipedia.com',
  'experiencealula.com',

  // General reference
  'wikipedia.org',
  'britannica.com',
  'archnet.org',
];

/**
 * True if a citation comes from a domain we are willing to show.
 *
 * Gemini returns the publisher in `title` (often the bare domain) while `uri`
 * is a redirect through Google, so both are checked. A subdomain of a trusted
 * domain counts; a domain that merely contains the name does not — the dot
 * prefix stops `notunesco.org` and `unesco.org.fake.com` from passing.
 */
export function isTrustedSource(title?: string, uri?: string): boolean {
  const haystacks = [title, uri].filter((v): v is string => Boolean(v)).map((v) => v.toLowerCase());

  return TRUSTED_DOMAINS.some((domain) =>
    haystacks.some((h) => {
      // Bare domain, or any subdomain of it.
      if (h === domain || h.endsWith(`.${domain}`)) return true;
      // Inside a URL: match the host segment only.
      try {
        const host = new URL(h.startsWith('http') ? h : `https://${h}`).hostname;
        return host === domain || host.endsWith(`.${domain}`);
      } catch {
        return false;
      }
    }),
  );
}
