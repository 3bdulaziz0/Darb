/**
 * OWNER: teammate A (T-10, T-29).
 *
 * DONE:  a single promise-based reader for the device's position that never
 *        throws and always says what went wrong.
 * TODO:  nothing here. The manual-area fallback is UI, and belongs on the
 *        screen that needs it — this file only reports what the device said.
 *
 * WHY IT NEVER THROWS: every caller has to keep working when location fails.
 * Denied location is a normal state for this product, not an error path — the
 * app stays fully usable without it, with a stated accuracy caveat. Returning
 * a result you must look at is harder to ignore than an exception you can
 * forget to catch.
 */

/** Why we could not get a position. */
export type LocationErrorKind =
  /** The user said no, or the browser blocked it (including insecure pages). */
  | 'denied'
  /** No GPS fix, no hardware, or the browser has no geolocation at all. */
  | 'unavailable'
  /** The device took longer than we were willing to wait. */
  | 'timeout';

export type LocationResult =
  | { ok: true; lat: number; lng: number; accuracy: number }
  | { ok: false; error: LocationErrorKind };

/** How long we wait for a fix before giving up. */
export const LOCATION_TIMEOUT_MS = 10_000;

/**
 * Asks the device where it is, once.
 *
 *   const result = await getPosition();
 *   if (result.ok) console.log(result.lat, result.lng, result.accuracy);
 *   else console.log(result.error);   // 'denied' | 'unavailable' | 'timeout'
 *
 * `accuracy` is the radius of uncertainty in metres, as reported by the
 * device. A large value means the fix is poor — show distances as approximate
 * rather than presenting a precise figure you cannot stand behind.
 *
 * Never throws and never rejects.
 */
export function getPosition(timeoutMs: number = LOCATION_TIMEOUT_MS): Promise<LocationResult> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve({ ok: false, error: 'unavailable' });
      return;
    }

    // The browser has its own timeout, but it is not always honoured on
    // mobile Safari, so we keep our own and take whichever fires first.
    let settled = false;
    const finish = (result: LocationResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => finish({ ok: false, error: 'timeout' }), timeoutMs);

    navigator.geolocation.getCurrentPosition(
      (position) =>
        finish({
          ok: true,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            finish({ ok: false, error: 'denied' });
            break;
          case error.TIMEOUT:
            finish({ ok: false, error: 'timeout' });
            break;
          default:
            finish({ ok: false, error: 'unavailable' });
        }
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  });
}
