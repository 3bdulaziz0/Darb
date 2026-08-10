/**
 * OWNER: shared. Development scaffolding only.
 *
 * DONE:  fake landmark, fake match, fake miss, fake origin, fake voices —
 *        enough for every page to render standalone with no camera, no GPS
 *        and no model.
 * TODO:  delete this file once real capture + recognition land. Nothing in
 *        here may survive into the demo build.
 *
 * RULE 1 NOTE: the fact text below is a PLACEHOLDER, not history. Real facts
 * live in public/landmarks.json and are curated by teammate D (T-2).
 */

import type { Coordinates, Landmark, MatchResult } from './types';

/**
 * Stand-in for the user's GPS fix, used by the screens that do not read real
 * location yet. Central Riyadh, a few hundred metres from Masmak Fort, so the
 * discovery list has something in it during development.
 */
export const MOCK_ORIGIN: Coordinates = { lat: 24.6308, lng: 46.7073 };

/** Renders the story page without waiting on a fetch. */
export const MOCK_LANDMARK: Landmark = {
  id: 'lm_masmak',
  name_ar: 'قصر المصمك',
  name_en: 'Masmak Fort',
  lat: 24.63111,
  lng: 46.71333,
  image: '/images/lm_masmak.jpg',
  facts: [
    {
      text_ar: 'نص تجريبي — الحقائق الحقيقية تأتي من landmarks.json وحدها.',
      text_en: 'PLACEHOLDER — the real facts come from landmarks.json and nowhere else.',
      source_name: 'PLACEHOLDER SOURCE',
      source_url: 'https://example.org/replace-me',
    },
  ],
  elements: ['أبراج مراقبة', 'بناء طيني', 'بوابة خشبية'],
  visual_markers: [
    'square clay and mud-brick fort with thick sand-colored walls',
    'four cylindrical watchtowers, one at each corner',
  ],
  category: 'heritage',
  tags: ['museum', 'outdoor', 'city_center'],
};

/** A confident hit — CameraPage routes this to /story/lm_masmak. */
export const MOCK_MATCH: MatchResult = {
  match_id: 'lm_masmak',
  confidence: 0.91,
  elements_seen: ['أبراج مراقبة', 'بناء طيني'],
};

/**
 * A miss — CameraPage routes this to /not-found (rule 3).
 * Flip MOCK_RESULT to this to exercise honest mode without a camera.
 */
export const MOCK_NO_MATCH: MatchResult = {
  match_id: null,
  confidence: 0.31,
  elements_seen: ['timber_roshan', 'mashrabiya', 'arched_doorway'],
};

/** What the recognize() stub returns by default. Swap to MOCK_NO_MATCH to
 *  test honest mode without touching the UI. */
export const MOCK_RESULT: MatchResult = MOCK_MATCH;

// ── Temporary dev override ──────────────────────────────────────────────────
/**
 * Forces the recognize() stub to return a null match, so the refusal path can
 * be demoed on demand from the camera screen. Toggled by the DEV chip in
 * CameraPage.
 *
 * Kept in sessionStorage rather than React state so it survives the trip to
 * /unknown and back via "Retake photo" — otherwise the toggle would reset the
 * moment you used it.
 *
 * TEMPORARY. This goes out with the rest of this file before the demo build.
 * The real refusal path comes from confidence < CONFIDENCE_THRESHOLD, not from
 * a switch. Do not let this survive into a build a judge sees.
 */
const FORCE_NO_MATCH_KEY = 'rawi:dev:force-no-match';

export function isForcedNoMatch(): boolean {
  try {
    return sessionStorage.getItem(FORCE_NO_MATCH_KEY) === '1';
  } catch {
    // Private browsing can throw on storage access. Default to honest-off.
    return false;
  }
}

export function setForcedNoMatch(on: boolean): void {
  try {
    if (on) sessionStorage.setItem(FORCE_NO_MATCH_KEY, '1');
    else sessionStorage.removeItem(FORCE_NO_MATCH_KEY);
  } catch {
    // Non-fatal — the toggle just won't persist across navigation.
  }
}

/** Element labels for honest mode. Curated glossary, not generated (T-16). */
export const MOCK_ELEMENT_LABELS: Record<string, string> = {
  roshan: 'Roshan',
  timber_roshan: 'Timber roshan',
  mashrabiya: 'Mashrabiya',
  coral_stone: 'Coral stone',
  arched_doorway: 'Arched doorway',
  minaret: 'Minaret',
};

