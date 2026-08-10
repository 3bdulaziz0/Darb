/**
 * OWNER: teammate D (data) — but treat it as shared; B and C both import it.
 *
 * DONE:  loading + validation of landmarks.json, haversine distance, radius
 *        filtering, nearest-covered-area fallback, fact sealing.
 * TODO:  nothing structural. The library grows by editing landmarks.json,
 *        never by editing this file (business rule 8).
 *
 * RULE 1: this module is the ONLY source of landmark facts in the app.
 * Nothing here generates, infers, or defaults a historical claim.
 *
 * ── How to use this file without reading it ────────────────────────────────
 *
 *   const landmarks = await loadLandmarks();              // once, on mount
 *   const list = nearby(landmarks, myLat, myLng, 5);      // within 5 km
 *   const fallback = nearestCoveredArea(landmarks, myLat, myLng);
 *
 * `loadLandmarks` is the only function here that touches the network.
 * Everything else is pure: same inputs, same outputs, no side effects, no
 * React. You can call them anywhere, in any order, as often as you like.
 *
 * Every function that needs the library takes it as its first argument. That
 * is deliberate — it means nothing here depends on hidden global state, and
 * every one of them can be tested with a two-item array. See library.test.ts.
 */

import type {
  Coordinates,
  Fact,
  Landmark,
  LandmarkWithDistance,
  SealedFact,
  SourcedText,
} from './types';
import { CATEGORIES, isCategory } from './categories';

// ── Loading ─────────────────────────────────────────────────────────────────

let cache: Promise<Landmark[]> | null = null;

/**
 * Fetches public/landmarks.json and checks that every entry is really a
 * landmark before handing it back.
 *
 * Loads once per session and remembers the result, so calling it from five
 * different components costs one network request.
 *
 * Throws if the file is missing, is not valid JSON, or contains a malformed
 * entry — and the error names the entry and the field that is wrong. It throws
 * loudly on purpose: a landmark with a typo'd `lat` would otherwise sit in the
 * library quietly placing a building in the sea.
 */
export function loadLandmarks(): Promise<Landmark[]> {
  if (!cache) {
    cache = fetch('/landmarks.json')
      .then((res) => {
        if (!res.ok) throw new Error(`landmarks.json: HTTP ${res.status}`);
        return res.json();
      })
      .then(parseLandmarks)
      .catch((err) => {
        // Never fall back to invented data. Failing loudly is honest; an empty
        // or half-guessed library is not.
        cache = null;
        throw err;
      });
  }
  return cache;
}

/**
 * Checks that a blob of parsed JSON really is an array of landmarks.
 *
 * Exported so the tests can use it directly, and so teammate D can paste a
 * draft entry into a scratch test to check it before committing. You will not
 * normally call this yourself — `loadLandmarks()` already does.
 */
export function parseLandmarks(data: unknown): Landmark[] {
  if (!Array.isArray(data)) {
    throw new Error('landmarks.json must contain an array of landmarks.');
  }

  data.forEach((entry, i) => {
    const where = `landmarks.json[${i}]`;
    const l = entry as Partial<Landmark>;

    if (typeof entry !== 'object' || entry === null) {
      throw new Error(`${where} is not an object.`);
    }

    requireString(l.id, `${where}.id`);
    requireString(l.name_ar, `${where}.name_ar`);
    requireString(l.name_en, `${where}.name_en`);
    requireString(l.image, `${where}.image`);

    requireLatitude(l.lat, `${where}.lat`);
    requireLongitude(l.lng, `${where}.lng`);

    requireStringArray(l.elements, `${where}.elements`);
    requireStringArray(l.visual_markers, `${where}.visual_markers`);

    // The Category union catches typos in our own code; this catches them in
    // the data file, where TypeScript cannot see them. A landmark with an
    // unknown category would disappear from every filter without a word.
    if (!isCategory(l.category)) {
      throw new Error(
        `${where}.category must be one of: ${CATEGORIES.join(', ')}. Got ${JSON.stringify(l.category)}.`,
      );
    }

    // tags are optional, but if present they must be strings.
    if (l.tags !== undefined) {
      requireStringArray(l.tags, `${where}.tags`);
    }

    if (!Array.isArray(l.facts)) {
      throw new Error(`${where}.facts must be an array.`);
    }
    l.facts.forEach((fact, f) => {
      const at = `${where}.facts[${f}]`;
      if (typeof fact !== 'object' || fact === null) {
        throw new Error(`${at} is not an object.`);
      }
      requireString(fact.text_ar, `${at}.text_ar`);
      requireString(fact.text_en, `${at}.text_en`);
      // RULE 2 at the door: a fact without a resolvable source is not data we
      // are willing to hold, let alone render.
      requireString(fact.source_name, `${at}.source_name`);
      requireString(fact.source_url, `${at}.source_url`);
    });
  });

  const ids = (data as Landmark[]).map((l) => l.id);
  const duplicate = ids.find((id, i) => ids.indexOf(id) !== i);
  if (duplicate) {
    throw new Error(`landmarks.json has two entries with id "${duplicate}".`);
  }

  return data as Landmark[];
}

function requireString(value: unknown, at: string): void {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${at} must be a non-empty string.`);
  }
}

function requireStringArray(value: unknown, at: string): void {
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
    throw new Error(`${at} must be an array of strings.`);
  }
}

function requireLatitude(value: unknown, at: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < -90 || value > 90) {
    throw new Error(`${at} must be a number between -90 and 90.`);
  }
}

function requireLongitude(value: unknown, at: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < -180 || value > 180) {
    throw new Error(`${at} must be a number between -180 and 180.`);
  }
}

/** Finds one landmark by id. Returns undefined if it is not in the library. */
export async function getLandmark(id: string): Promise<Landmark | undefined> {
  const all = await loadLandmarks();
  return all.find((l) => l.id === id);
}

// ── Distance ────────────────────────────────────────────────────────────────

const EARTH_RADIUS_KM = 6371;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * How far apart two points are, in kilometres, measured over the curve of the
 * Earth (the "haversine" formula — the standard way to do this).
 *
 * Takes any two things that have a `lat` and an `lng`, so you can pass a
 * landmark straight in:
 *
 *   distanceKm({ lat: 21.48, lng: 39.18 }, someLandmark)  // => 0.4
 *
 * Accurate to a few metres at city scale, which is far better than a phone's
 * GPS. Order does not matter: distanceKm(a, b) === distanceKm(b, a).
 */
export function distanceKm(a: Coordinates, b: Coordinates): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Every landmark paired with its distance from the user, nearest first. */
function sortedByDistance(
  landmarks: Landmark[],
  userLat: number,
  userLng: number,
): LandmarkWithDistance[] {
  const origin = { lat: userLat, lng: userLng };
  return landmarks
    .map((landmark) => ({ landmark, distance_km: distanceKm(origin, landmark) }))
    .sort((a, b) => a.distance_km - b.distance_km);
}

/**
 * The landmarks within `radiusKm` of the user, closest one first.
 *
 *   nearby(landmarks, 21.4841, 39.1869, 5)
 *   // => [{ landmark, distance_km: 0.04 }, { landmark, distance_km: 0.23 }]
 *
 * A landmark sitting exactly on the radius counts as inside it.
 *
 * Returns an empty array when nothing is in range. That is a real answer, not
 * a failure — show the honest empty state and offer a wider radius. Never pad
 * the list with places that are not in the curated library.
 */
export function nearby(
  landmarks: Landmark[],
  userLat: number,
  userLng: number,
  radiusKm: number,
): LandmarkWithDistance[] {
  return sortedByDistance(landmarks, userLat, userLng).filter(
    (r) => r.distance_km <= radiusKm,
  );
}

/**
 * The single closest landmark, however far away it is.
 *
 * This is for the empty state: when nothing is within the chosen radius, we
 * still tell the visitor where our coverage actually starts and how far that
 * is, rather than showing them a blank screen.
 *
 * Returns null only if the library itself is empty.
 */
export function nearestCoveredArea(
  landmarks: Landmark[],
  userLat: number,
  userLng: number,
): LandmarkWithDistance | null {
  return sortedByDistance(landmarks, userLat, userLng)[0] ?? null;
}

/**
 * The ids recognition is allowed to choose from — everything within
 * `radiusKm` of the user, nearest first.
 *
 * Narrowing by GPS before matching is what turns "identify any building on
 * Earth" into "pick one of these four". Recognition must never return an id
 * that is not in this list.
 */
export function selectCandidates(
  landmarks: Landmark[],
  userLat: number,
  userLng: number,
  radiusKm: number,
): string[] {
  return nearby(landmarks, userLat, userLng, radiusKm).map((r) => r.landmark.id);
}

// ── Rule 2: sealing ─────────────────────────────────────────────────────────

function seal(text: string, fact: Fact): SourcedText {
  return {
    __sourced: 'fact',
    text,
    source_name: fact.source_name,
    source_url: fact.source_url,
  };
}

/**
 * Wraps a landmark's facts so their text cannot be rendered without its
 * source. Pass the result to <SourcedFact/>; there is nothing else you can
 * usefully do with it, which is the point. See CLAUDE.md, rule 2.
 *
 * A fact with no source is dropped here rather than shown bare.
 */
export function sealFacts(landmark: Landmark): SealedFact[] {
  return landmark.facts
    .filter((f) => Boolean(f.source_url) && Boolean(f.source_name))
    .map((f) => ({
      text_ar: seal(f.text_ar, f),
      text_en: seal(f.text_en, f),
      source_name: f.source_name,
      source_url: f.source_url,
    }));
}

// ── Formatting ──────────────────────────────────────────────────────────────

/** Turns 0.42 into "420 M" and 2.37 into "2.4 KM", for display. */
export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} M` : `${km.toFixed(1)} KM`;
}
