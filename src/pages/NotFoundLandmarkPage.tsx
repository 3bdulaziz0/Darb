/**
 * OWNER: teammate C (T-15, T-16).
 *
 * DONE:  the honest-mode sheet from design/unknown_building_state — refusal
 *        statement, "what I can see" element list, and two ways forward.
 * TODO:  1. EXPLAIN opens a curated glossary entry (T-16). The explanation
 *           comes from the library's element_glossary — never from the model.
 *        2. Show the captured frame as the hero instead of the placeholder.
 *
 * ── RULE 3 ──────────────────────────────────────────────────────────────────
 * THIS PAGE MUST NEVER DISPLAY A NAME, A DATE, OR A STORY.
 *
 * It deliberately does not import library.ts, getLandmark, or SourcedFact.
 * There is no landmark in scope here and there must not be one. All this page
 * receives is a list of element keys observed in the photo.
 *
 * This is the product's headline behaviour. Every competing team will demo a
 * successful match; almost none will demo a correct refusal. Do not water it
 * down into a "we think it might be…" screen.
 * ────────────────────────────────────────────────────────────────────────────
 */

import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLang } from '../lib/i18n';
import { MOCK_ELEMENT_LABELS, MOCK_NO_MATCH } from '../lib/mockData';

interface HonestModeState {
  elements_seen?: string[];
  /** The frame the visitor captured. The only thing we can honestly show. */
  capture?: { image: string };
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 rtl:rotate-180"
         fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export default function NotFoundLandmarkPage() {
  const navigate = useNavigate();
  const { t } = useLang();
  const state = (useLocation().state ?? {}) as HonestModeState;

  // Opened directly (no capture)? Fall back to the mock miss so the page
  // renders standalone during development.
  const elements = state.elements_seen ?? MOCK_NO_MATCH.elements_seen;
  const hero = state.capture?.image ?? '/images/unknown.svg';

  return (
    <div className="relative h-full w-full">
      {/* Hero — the building we are refusing to name. */}
      <div className="absolute inset-x-0 top-0 h-[40%]">
        <img src={hero} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-transparent" />
      </div>

      <section className="absolute inset-x-0 bottom-0 top-[34%] z-10 flex flex-col rounded-t-sheet bg-surface">
        <div className="flex shrink-0 justify-center pb-2 pt-4">
          <span className="h-1.5 w-12 rounded-full bg-muted/30" />
        </div>

        <div className="scroll-area flex-1 px-gutter">
          <h1 className="mb-3 text-display text-white">{t('dontRecogniseTitle')}</h1>
          <p className="mb-6 text-body-lg text-muted">{t('dontRecogniseBody')}</p>

          <hr className="mb-6 border-hairline" />

          <h2 className="mb-3 label-caps text-muted">{t('butICanSee')}</h2>

          <ul className="flex flex-col gap-3 pb-6">
            {elements.map((key) => (
              <li key={key}>
                <button
                  type="button"
                  disabled
                  className="flex w-full items-center gap-4 rounded-ctl border border-hairline
                             bg-surface-high/60 p-3 text-start disabled:opacity-90"
                >
                  <img
                    src="/images/element.svg"
                    alt=""
                    className="h-14 w-14 shrink-0 rounded object-cover"
                  />
                  <span className="flex-1 text-body-lg text-white">
                    {MOCK_ELEMENT_LABELS[key] ?? key}
                  </span>
                  {/* TODO(C): T-16 — open the curated glossary entry. */}
                  <span className="flex items-center gap-1 label-caps text-accent-soft">
                    {t('explain')}
                    <ChevronIcon />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* A way forward, never a dead end. */}
        <div className="shrink-0 space-y-3 border-t border-hairline p-gutter pb-8">
          <Link
            to="/discover"
            className="flex h-14 items-center justify-center rounded-full bg-accent
                       text-body-lg font-semibold text-white"
          >
            {t('browseNearby')}
          </Link>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex h-14 w-full items-center justify-center rounded-full border
                       border-accent/60 text-body-lg text-accent-soft"
          >
            {t('retakePhoto')}
          </button>
        </div>
      </section>
    </div>
  );
}
