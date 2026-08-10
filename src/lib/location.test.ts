/**
 * OWNER: teammate A, alongside location.ts.  Run with:  npm test
 *
 * These fake `navigator.geolocation` rather than asking the machine where it
 * is. The point is the branching: every failure the browser can hand us must
 * come back as a typed result, and nothing may throw.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPosition } from './location';

const original = globalThis.navigator;

/** Installs a fake geolocation that calls success/error however we say. */
function fakeGeolocation(impl: Partial<Geolocation> | null) {
  Object.defineProperty(globalThis, 'navigator', {
    value: impl === null ? {} : { geolocation: impl },
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  Object.defineProperty(globalThis, 'navigator', {
    value: original,
    configurable: true,
    writable: true,
  });
  vi.useRealTimers();
});

describe('getPosition', () => {
  it('returns coordinates and accuracy on success', async () => {
    fakeGeolocation({
      getCurrentPosition: (success) =>
        (success as PositionCallback)({
          coords: { latitude: 24.63111, longitude: 46.71333, accuracy: 12 },
        } as GeolocationPosition),
    });

    const result = await getPosition();
    expect(result).toEqual({ ok: true, lat: 24.63111, lng: 46.71333, accuracy: 12 });
  });

  it('reports a refusal as denied', async () => {
    fakeGeolocation({
      getCurrentPosition: (_s, error) =>
        (error as PositionErrorCallback)({
          code: 1,
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        } as GeolocationPositionError),
    });

    await expect(getPosition()).resolves.toEqual({ ok: false, error: 'denied' });
  });

  it('reports a missing fix as unavailable', async () => {
    fakeGeolocation({
      getCurrentPosition: (_s, error) =>
        (error as PositionErrorCallback)({
          code: 2,
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        } as GeolocationPositionError),
    });

    await expect(getPosition()).resolves.toEqual({ ok: false, error: 'unavailable' });
  });

  it("reports the browser's own timeout as timeout", async () => {
    fakeGeolocation({
      getCurrentPosition: (_s, error) =>
        (error as PositionErrorCallback)({
          code: 3,
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        } as GeolocationPositionError),
    });

    await expect(getPosition()).resolves.toEqual({ ok: false, error: 'timeout' });
  });

  it('gives up on its own if the device never answers', async () => {
    vi.useFakeTimers();
    fakeGeolocation({ getCurrentPosition: () => undefined }); // never calls back

    const pending = getPosition(10_000);
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(pending).resolves.toEqual({ ok: false, error: 'timeout' });
  });

  it('reports unavailable when the browser has no geolocation at all', async () => {
    fakeGeolocation(null);
    await expect(getPosition()).resolves.toEqual({ ok: false, error: 'unavailable' });
  });

  it('ignores a late answer that arrives after the timeout', async () => {
    vi.useFakeTimers();
    // Held in an object rather than a bare `let`, so TypeScript does not
    // narrow it to `never` by assuming the closure never runs.
    const held: { success: PositionCallback | null } = { success: null };
    fakeGeolocation({
      getCurrentPosition: (success) => {
        held.success = success as PositionCallback;
      },
    });

    const pending = getPosition(10_000);
    await vi.advanceTimersByTimeAsync(10_000);

    // The device finally answers, well after we gave up.
    held.success?.({ coords: { latitude: 1, longitude: 2, accuracy: 3 } } as GeolocationPosition);

    await expect(pending).resolves.toEqual({ ok: false, error: 'timeout' });
  });
});
