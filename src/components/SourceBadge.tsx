/**
 * OWNER: shared. Changes here need a second pair of eyes — this file is where
 * rule 2 is enforced.
 *
 * DONE:  the source pill, and <SourcedFact/>, the only component in the app
 *        that can render fact text.
 * TODO:  nothing. Style it, don't loosen it.
 *
 * Source badges are a designed element, not a footnote (PRD 7.1). Do not
 * shrink this into fine print.
 */

import { STRINGS } from '../lib/i18n';
import type { Lang, SealedFact } from '../lib/types';

function LinkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5" />
    </svg>
  );
}

/**
 * The pill itself: link icon + source name, opens the reference in a new tab.
 * 32px tall per the design system, with an invisible 44px tap area behind it.
 */
export function SourceBadge({ name, url }: { name: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      // `before:` gives the 44px touch target without inflating the pill.
      className="relative inline-flex min-h-[32px] items-center gap-1.5 rounded-full border
                 border-hairline bg-surface-high/60 px-3 text-muted transition-colors
                 hover:border-accent-soft/40 hover:text-accent-soft
                 before:absolute before:inset-x-0 before:top-1/2 before:h-touch
                 before:-translate-y-1/2 before:content-['']"
    >
      <LinkIcon />
      <span className="label-caps">{name}</span>
    </a>
  );
}

/**
 * The ONLY way to put a fact on screen.
 *
 * `SealedFact.text_*` is a SourcedText object, not a string — React refuses to
 * render it and TypeScript refuses to compile it. Unwrapping happens here, in
 * the same element that renders the badge. There is no code path that produces
 * fact text without its source, because there is nowhere else to unwrap it.
 */
export function SourcedFact({ fact, lang }: { fact: SealedFact; lang: Lang }) {
  const preferred = lang === 'ar' ? fact.text_ar : fact.text_en;
  const other = lang === 'ar' ? fact.text_en : fact.text_ar;

  // Some library entries carry only one language so far. Show the language we
  // actually have and say so — never machine-translate the missing one into
  // existence, and never show a blank where a fact should be.
  const pending = preferred.text.trim() === '';
  const sourced = pending ? other : preferred;

  return (
    <div className="flex flex-col items-start gap-2">
      <p
        className="text-body text-white/90"
        dir={sourced === fact.text_ar ? 'rtl' : 'ltr'}
      >
        {sourced.text}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <SourceBadge name={sourced.source_name} url={sourced.source_url} />
        {pending && (
          <span className="flex min-h-[32px] items-center rounded-full border border-sand/30
                           bg-sand/10 px-3 label-caps text-sand">
            {STRINGS[lang].translationPending}
          </span>
        )}
      </div>
    </div>
  );
}

export default SourceBadge;
