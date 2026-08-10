/**
 * OWNER: teammate D (data).
 *
 * Run with:  npm run sources:ar
 *
 * Fills in `source_url_ar` for every fact whose publisher has an Arabic
 * mirror of the same page, so an Arabic reader tapping a source badge lands
 * on Arabic.
 *
 * ── What this does NOT do ──────────────────────────────────────────────────
 * It does not translate anything, and it does not copy any text from the
 * source. It only rewrites a URL. The Arabic fact text stays empty and the
 * story page keeps saying "الترجمة قيد الإعداد" until a human writes it.
 *
 * Visit Saudi serves the same page at /ar/ that it serves at /en/, verified
 * with live requests. Wikipedia is not rewritten: ar.wikipedia.org is a
 * separate encyclopedia with its own articles and its own claims, not a
 * translation of the English one, so pointing a source badge at it would be
 * citing something we never read.
 * ───────────────────────────────────────────────────────────────────────────
 */

import { readFileSync, writeFileSync } from 'node:fs';

const LIBRARY = new URL('../public/landmarks.json', import.meta.url);

/** Publishers that mirror the same page in Arabic, and how to get there. */
const MIRRORS = [
  {
    host: 'visitsaudi.com',
    toArabic: (url) => (url.includes('/en/') ? url.replace('/en/', '/ar/') : null),
  },
];

const landmarks = JSON.parse(readFileSync(LIBRARY, 'utf8'));

let filled = 0;
let skipped = 0;

for (const landmark of landmarks) {
  for (const fact of landmark.facts) {
    let host;
    try {
      host = new URL(fact.source_url).hostname;
    } catch {
      continue;
    }

    const mirror = MIRRORS.find((m) => host.endsWith(m.host));
    const arabic = mirror?.toArabic(fact.source_url) ?? null;

    if (arabic) {
      fact.source_url_ar = arabic;
      filled += 1;
    } else {
      delete fact.source_url_ar;
      skipped += 1;
    }
  }
}

writeFileSync(LIBRARY, JSON.stringify(landmarks, null, 2) + '\n', 'utf8');

console.log('');
console.log(`facts with an Arabic source link : ${filled}`);
console.log(`facts left on their only language: ${skipped}`);
console.log('');
console.log('This rewrites links only. Arabic fact text is still written by a human.');
console.log('');
