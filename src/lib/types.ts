/**
 * OWNER: nobody. This file is frozen — every other file is written against
 * these shapes, so a change here is a change to everyone's work. Raise it with
 * the whole team first.
 *
 * DONE:  the full data contract for the MVP.
 * TODO:  nothing. Do not extend this file to hold app state or UI props.
 *
 * CHANGELOG
 *   day 1 — original contract.
 *   day 2 — added Landmark.category (required) and Landmark.tags (optional).
 *           Adding `category` means every entry in landmarks.json must carry
 *           one; loadLandmarks() rejects the file otherwise.
 *   day 2 — added Landmark.city (optional). Relaxed name_ar and Fact.text_ar
 *           to allow an empty string while a translation is pending, because
 *           the bulk library arrived English-only. A fact must still carry
 *           text in at least one language, and always its source.
 */

// ── Language ────────────────────────────────────────────────────────────────
// Structure only. No toggle is built yet (teammate C, T-18).
export type Lang = 'ar' | 'en';

// ── Data contract (fixed — mirrors public/landmarks.json exactly) ───────────

export interface Fact {
  /**
   * The fact in each language. One of the two may be an empty string while a
   * translation is pending — the UI then shows the language we do have, with a
   * "translation pending" label. It never machine-translates the other one
   * into existence, and never renders a fact that is empty in both.
   */
  text_ar: string;
  text_en: string;
  source_name: string;
  source_url: string;
  /**
   * The same reference on the source's own Arabic page, when it publishes one.
   *
   * An Arabic reader tapping a source badge should land on Arabic, not on the
   * English page. This is a link to the publisher's translation — we never
   * copy their text in, and we never translate it ourselves.
   */
  source_url_ar?: string;
}

/**
 * What kind of place this is. A fixed set, not free text — a typo like
 * 'religous' fails to compile rather than quietly creating an eighth category
 * that no filter will ever match.
 *
 * Display and filtering only. See lib/categories.ts for labels and colours.
 */
export type Category =
  | 'heritage'
  | 'religious'
  | 'archaeological'
  | 'museum'
  | 'market'
  | 'natural'
  | 'modern';

export interface Landmark {
  id: string;
  /** May be empty while a translation is pending. Never invented. */
  name_ar: string;
  name_en: string;
  lat: number;
  lng: number;
  /** The photo shown on the card and the story page. */
  image: string;
  /**
   * Photos of this landmark from several angles, for the recogniser to match a
   * captured frame against. Written by `npm run photos`, never by hand — drop
   * files into public/landmarks/<id>/ and run it.
   *
   * Absent means we have no photo of this place yet, so we cannot claim to
   * recognise it from one.
   */
  reference_images?: string[];
  facts: Fact[];
  /** Architectural element keys, e.g. "roshan". NOT historical claims. */
  elements: string[];
  /** Free-text visual cues used by recognition. Never rendered as a fact. */
  visual_markers: string[];
  /**
   * What kind of place this is — for the story chip and the discovery filter.
   *
   * NEVER send this to recognition. Telling the matcher "this one is a mosque"
   * biases it toward a category instead of matching what is actually in the
   * photograph, and a confident wrong match is the failure this product exists
   * to prevent. Recognition sees candidate ids and visual markers, nothing else.
   */
  category: Category;
  /** Optional free-text keywords. Display and search only, same rule as above. */
  tags?: string[];
  /**
   * Which city the landmark is in. The library outgrew a single district, and
   * the discovery screen has to be able to say where our coverage actually is.
   * Display and filtering only, same rule as category.
   */
  city?: string;
}

/**
 * One press of the capture button: the frame, and where the user was standing
 * when they took it.
 *
 * This travels from CameraPage to whichever screen resolves it, so it lives
 * here rather than in a page file. `lat`/`lng`/`accuracy` are null whenever we
 * have no fix — never 0, never a guessed default, because a guessed position
 * silently picks the wrong candidates.
 */
export interface Capture {
  /** JPEG data URL of the captured frame. */
  image: string;
  lat: number | null;
  lng: number | null;
  /** Radius of uncertainty in metres, as reported by the device. */
  accuracy: number | null;
  /** True when the user refused location. Later screens must stay usable. */
  locationDenied: boolean;
}

export interface MatchResult {
  /** null means: we do not recognise this building. Route to /unknown. */
  match_id: string | null;
  confidence: number;
  elements_seen: string[];
}

// ── Rule 2, enforced by the compiler ────────────────────────────────────────
/**
 * A fact's text is never handed out as a bare string. `library.ts` seals every
 * Fact into this shape, where the text is wrapped in an object React cannot
 * render. The only code that unwraps it is <SourcedFact/>, which renders the
 * text and its <SourceBadge/> together, in one element, always.
 *
 * So this is a type error, by design:
 *     <p>{fact.text_en}</p>
 *     // Type 'SourcedText' is not assignable to type 'ReactNode'
 *
 * This is a compile-time guard, not a sandbox — someone determined can still
 * reach in and read `.text`. That is a deliberate, greppable act and it will
 * be caught in review. The point is that you cannot do it by accident.
 */
export interface SourcedText {
  readonly __sourced: 'fact';
  readonly text: string;
  readonly source_name: string;
  readonly source_url: string;
}

/** What the rest of the app sees instead of a raw `Fact`. */
export interface SealedFact {
  readonly text_ar: SourcedText;
  readonly text_en: SourcedText;
  readonly source_name: string;
  readonly source_url: string;
}

// ── Discovery ───────────────────────────────────────────────────────────────

export interface Coordinates {
  lat: number;
  lng: number;
}

/** The three radii offered on the discovery screen (Epic 6). */
export type RadiusKm = 1 | 5 | 20;

/**
 * What the discovery list is scoped to: a radius around the visitor, or the
 * whole library.
 *
 * 'all' exists because the library outgrew one district. A visitor in Riyadh
 * has four landmarks within 5 km and 190 in the country, and there was no way
 * to see the rest. Still sorted by true distance — 'all' widens the scope, it
 * does not stop measuring.
 */
export type DiscoveryScope = RadiusKm | 'all';

export interface LandmarkWithDistance {
  landmark: Landmark;
  distance_km: number;
}

// ── Status (Epic 5) ─────────────────────────────────────────────────────────

/** The three named stages shown while a capture is being resolved. */
export type Stage = 'locating' | 'matching' | 'fetching';
