/**
 * OWNER: teammate D, alongside library.ts.
 *
 * Run these with:  npm test
 *
 * These cover the pure functions only — the maths and the validation. There is
 * no network, no React and no mocking here; every test builds a two-landmark
 * library by hand and checks what comes back.
 *
 * If you change library.ts and one of these goes red, the test is probably
 * right and the change is probably wrong. Distances and radius filtering decide
 * which landmarks recognition is even allowed to consider, so an error here
 * shows up as "it didn't recognise the building I was standing in front of".
 */

import { describe, expect, it } from 'vitest';
import {
  distanceKm,
  formatDistance,
  nearby,
  nearestCoveredArea,
  parseLandmarks,
  sealFacts,
  selectCandidates,
} from './library';
import type { Landmark } from './types';

// ── Fixtures ────────────────────────────────────────────────────────────────

/** Builds a landmark with sane defaults; override just what a test cares about. */
function makeLandmark(over: Partial<Landmark> = {}): Landmark {
  return {
    id: 'lm_test',
    name_ar: 'معلم',
    name_en: 'Test Landmark',
    lat: 21.4838,
    lng: 39.1866,
    image: '/images/lm_01.svg',
    facts: [
      {
        text_ar: 'نص',
        text_en: 'text',
        source_name: 'Source',
        source_url: 'https://example.org/a',
      },
    ],
    elements: ['roshan'],
    visual_markers: ['coral stone facade'],
    category: 'heritage',
    ...over,
  };
}

// Two real-ish points in Al-Balad, Jeddah, ~250 m apart.
const NASEEF = makeLandmark({ id: 'lm_01', lat: 21.4838, lng: 39.1866 });
const SHAFII = makeLandmark({ id: 'lm_02', lat: 21.482, lng: 39.1873 });
const LIBRARY = [SHAFII, NASEEF]; // deliberately NOT in distance order

const JEDDAH = { lat: 21.4841, lng: 39.1869 };
const RIYADH = { lat: 24.7136, lng: 46.6753 };

// ── distanceKm ──────────────────────────────────────────────────────────────

describe('distanceKm', () => {
  it('is zero for the same point', () => {
    expect(distanceKm(JEDDAH, JEDDAH)).toBe(0);
  });

  it('measures one degree of latitude as about 111 km', () => {
    // A degree of latitude is ~111.19 km anywhere on Earth — the simplest
    // independent check that the formula is right.
    const d = distanceKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(d).toBeGreaterThan(111.1);
    expect(d).toBeLessThan(111.3);
  });

  it('measures Jeddah to Riyadh as about 850 km', () => {
    const d = distanceKm(JEDDAH, RIYADH);
    expect(d).toBeGreaterThan(840);
    expect(d).toBeLessThan(855);
  });

  it('gives the same answer in either direction', () => {
    expect(distanceKm(JEDDAH, RIYADH)).toBeCloseTo(distanceKm(RIYADH, JEDDAH), 9);
  });

  it('accepts a landmark directly, since it has lat and lng', () => {
    expect(distanceKm(JEDDAH, NASEEF)).toBeLessThan(0.1); // ~40 m
  });
});

// ── nearby ──────────────────────────────────────────────────────────────────

describe('nearby', () => {
  it('returns landmarks sorted nearest first, whatever order they came in', () => {
    const result = nearby(LIBRARY, JEDDAH.lat, JEDDAH.lng, 5);
    expect(result.map((r) => r.landmark.id)).toEqual(['lm_01', 'lm_02']);
  });

  it('attaches the distance to each result', () => {
    const [first] = nearby(LIBRARY, JEDDAH.lat, JEDDAH.lng, 5);
    expect(first.distance_km).toBeGreaterThan(0);
    expect(first.distance_km).toBeLessThan(0.1);
  });

  it('excludes landmarks outside the radius', () => {
    // From Riyadh, nothing in Al-Balad is within 20 km.
    expect(nearby(LIBRARY, RIYADH.lat, RIYADH.lng, 20)).toEqual([]);
  });

  it('counts a landmark exactly on the radius as inside it', () => {
    const exact = distanceKm(JEDDAH, SHAFII);
    const result = nearby(LIBRARY, JEDDAH.lat, JEDDAH.lng, exact);
    expect(result.map((r) => r.landmark.id)).toContain('lm_02');
  });

  it('returns an empty array for an empty library rather than throwing', () => {
    expect(nearby([], JEDDAH.lat, JEDDAH.lng, 20)).toEqual([]);
  });

  it('does not modify the array it was given', () => {
    const order = LIBRARY.map((l) => l.id);
    nearby(LIBRARY, JEDDAH.lat, JEDDAH.lng, 5);
    expect(LIBRARY.map((l) => l.id)).toEqual(order);
  });
});

// ── nearestCoveredArea ──────────────────────────────────────────────────────

describe('nearestCoveredArea', () => {
  it('finds the closest landmark however far away it is', () => {
    const result = nearestCoveredArea(LIBRARY, RIYADH.lat, RIYADH.lng);
    expect(result?.landmark.id).toBe('lm_01');
    expect(result?.distance_km).toBeGreaterThan(800);
  });

  it('returns null only when the library is empty', () => {
    expect(nearestCoveredArea([], JEDDAH.lat, JEDDAH.lng)).toBeNull();
  });
});

// ── selectCandidates ────────────────────────────────────────────────────────

describe('selectCandidates', () => {
  it('returns ids only, nearest first', () => {
    expect(selectCandidates(LIBRARY, JEDDAH.lat, JEDDAH.lng, 5)).toEqual(['lm_01', 'lm_02']);
  });

  it('returns nothing when the user is nowhere near the library', () => {
    // An empty candidate set must resolve to a refusal, never a wider search.
    expect(selectCandidates(LIBRARY, RIYADH.lat, RIYADH.lng, 1)).toEqual([]);
  });
});

// ── parseLandmarks ──────────────────────────────────────────────────────────

describe('parseLandmarks', () => {
  it('accepts a well-formed library', () => {
    expect(parseLandmarks([makeLandmark()])).toHaveLength(1);
  });

  it('rejects anything that is not an array', () => {
    expect(() => parseLandmarks({ landmarks: [] })).toThrow(/must contain an array/);
  });

  it('names the entry and field that is wrong', () => {
    const bad = [makeLandmark(), makeLandmark({ id: '' })];
    expect(() => parseLandmarks(bad)).toThrow(/landmarks\.json\[1\]\.id/);
  });

  it('rejects a latitude that is out of range', () => {
    expect(() => parseLandmarks([makeLandmark({ lat: 214.838 })])).toThrow(/lat/);
  });

  it('rejects a latitude that arrived as a string', () => {
    expect(() => parseLandmarks([makeLandmark({ lat: '21.48' as never })])).toThrow(/lat/);
  });

  it('rejects a fact with no source url', () => {
    const noSource = makeLandmark({
      facts: [{ text_ar: 'نص', text_en: 'text', source_name: 'Source', source_url: '' }],
    });
    expect(() => parseLandmarks([noSource])).toThrow(/facts\[0\]\.source_url/);
  });

  it('rejects a category that is not one of ours', () => {
    // The union catches this in our own code; landmarks.json is data, so this
    // is the only thing standing between a typo and a landmark that silently
    // vanishes from every filter.
    const typo = [makeLandmark({ category: 'religous' as never })];
    expect(() => parseLandmarks(typo)).toThrow(/category must be one of/);
  });

  it('rejects a landmark with no category at all', () => {
    const missing = makeLandmark();
    delete (missing as Partial<Landmark>).category;
    expect(() => parseLandmarks([missing])).toThrow(/category/);
  });

  it('accepts a landmark with no tags, since tags are optional', () => {
    const noTags = makeLandmark();
    expect(parseLandmarks([noTags])[0].tags).toBeUndefined();
  });

  it('rejects tags that are not strings', () => {
    expect(() => parseLandmarks([makeLandmark({ tags: [42] as never })])).toThrow(/tags/);
  });

  it('rejects two landmarks sharing an id', () => {
    const clash = [makeLandmark({ id: 'lm_01' }), makeLandmark({ id: 'lm_01' })];
    expect(() => parseLandmarks(clash)).toThrow(/two entries with id "lm_01"/);
  });
});

// ── sealFacts ───────────────────────────────────────────────────────────────

describe('sealFacts', () => {
  it('wraps fact text together with its source', () => {
    const [fact] = sealFacts(makeLandmark());
    expect(fact.text_en.text).toBe('text');
    expect(fact.text_en.source_url).toBe('https://example.org/a');
  });

  it('drops a fact that has no source instead of rendering it bare', () => {
    const unsourced = makeLandmark({
      facts: [{ text_ar: 'نص', text_en: 'text', source_name: '', source_url: '' }],
    });
    expect(sealFacts(unsourced)).toEqual([]);
  });
});

// ── formatDistance ──────────────────────────────────────────────────────────

describe('formatDistance', () => {
  it('shows metres below one kilometre', () => {
    expect(formatDistance(0.42)).toBe('420 M');
  });

  it('shows one decimal place above one kilometre', () => {
    expect(formatDistance(2.37)).toBe('2.4 KM');
  });
});
