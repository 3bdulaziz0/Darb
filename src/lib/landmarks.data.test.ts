/**
 * OWNER: teammate D.  Run with:  npm test
 *
 * Runs the real public/landmarks.json through the real validator. Every other
 * test uses hand-built fixtures; this one is the guard on the shipped file, so
 * a bad entry fails here rather than as a white screen on someone's phone.
 *
 * Add a landmark, run `npm test`. If it goes red, the error names the entry
 * and the field.
 */

import { describe, expect, it } from 'vitest';
import { isRecognisable, parseLandmarks } from './library';
// Imported rather than read from disk, so this needs no Node types and works
// the same in any runner. It is a test-only import — the app fetches the file.
import raw from '../../public/landmarks.json';

describe('public/landmarks.json', () => {
  it('satisfies the contract loadLandmarks() enforces', () => {
    expect(() => parseLandmarks(raw)).not.toThrow();
  });

  const landmarks = parseLandmarks(raw);

  it('has entries', () => {
    expect(landmarks.length).toBeGreaterThan(0);
  });

  it('gives every fact a resolvable http(s) source', () => {
    for (const l of landmarks) {
      for (const f of l.facts) {
        expect(() => new URL(f.source_url), `${l.id} → ${f.source_url}`).not.toThrow();
        expect(f.source_url, `${l.id}`).toMatch(/^https?:\/\//);
      }
    }
  });

  it('places every landmark inside Saudi Arabia, roughly', () => {
    // A wrong sign or a swapped lat/lng lands a landmark in the ocean and
    // quietly removes it from every radius search. This catches that.
    for (const l of landmarks) {
      expect(l.lat, `${l.id} lat`).toBeGreaterThan(15);
      expect(l.lat, `${l.id} lat`).toBeLessThan(33);
      expect(l.lng, `${l.id} lng`).toBeGreaterThan(34);
      expect(l.lng, `${l.id} lng`).toBeLessThan(56);
    }
  });

  it('still has at least one landmark recognition can actually identify', () => {
    // Most of the library is listable but not yet identifiable. If this ever
    // hits zero, the camera can only ever refuse.
    expect(landmarks.filter(isRecognisable).length).toBeGreaterThan(0);
  });
});
