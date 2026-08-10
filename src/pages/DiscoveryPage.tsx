/**
 * OWNER: teammate C (T-31, T-32, T-33, T-34).
 *
 * DONE:  the discovery screen from design/nearby_landmarks and
 *        design/empty_discovery_state — map placeholder, 1/5/20 km selector,
 *        distance-sorted list, honest empty state, bottom nav.
 * TODO:  1. Real map with the user's position and landmark pins (T-32).
 *        2. Real geolocation as the distance origin, with accuracy captured
 *           (T-29, teammate A). If permission is denied, hide distances —
 *           never estimate them from an assumed position.
 *        3. Progressive loading once the list can exceed a screenful (T-31).
 *        4. External maps handoff per row (T-34).
 *
 * RULE 1: the list shows curated library entries only. When the radius is
 * empty, say so — do not pad the list with uncurated places.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import LandmarkCard from '../components/LandmarkCard';
import { CATEGORIES, categoryColor, categoryLabel } from '../lib/categories';
import {
  formatDistance,
  loadLandmarks,
  nearby,
  nearestCoveredArea,
  withDistance,
} from '../lib/library';
import { MOCK_LANG, MOCK_ORIGIN } from '../lib/mockData';
import type { Category, DiscoveryScope, Landmark } from '../lib/types';

const SCOPES: DiscoveryScope[] = [1, 5, 20, 'all'];

/** Rows rendered per step. 190 at once is a lot of DOM on a phone. */
const PAGE_SIZE = 20;

function CompassIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5"
         fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="m15 9-2 4-4 2 2-4Z" />
    </svg>
  );
}

function ShutterIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5"
         fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v9l7.8 4.5M12 12 4.2 16.5M12 12l7.8-4.5" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5"
         fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9 5.3 5.3" />
    </svg>
  );
}

function BottomNav() {
  return (
    <nav className="flex shrink-0 items-center justify-around border-t border-hairline bg-surface px-gutter py-3">
      <span aria-current="page" className="control bg-accent text-white">
        <CompassIcon />
      </span>
      <Link to="/" aria-label="Camera" className="control border border-hairline text-muted">
        <ShutterIcon />
      </Link>
      <Link to="/settings" aria-label="Settings" className="control border border-hairline text-muted">
        <GearIcon />
      </Link>
    </nav>
  );
}

export default function DiscoveryPage() {
  const navigate = useNavigate();
  const lang = MOCK_LANG;

  const [library, setLibrary] = useState<Landmark[]>([]);
  const [scope, setScope] = useState<DiscoveryScope>(5);
  const [category, setCategory] = useState<Category | 'all'>('all');
  /** How many rows are on screen. Grows in PAGE_SIZE steps, never all at once. */
  const [shown, setShown] = useState(PAGE_SIZE);

  // TODO(A/C): real coordinates from the Geolocation API (T-29).
  const origin = MOCK_ORIGIN;

  useEffect(() => {
    void loadLandmarks().then(setLibrary);
  }, []);

  // Both filters apply at once: narrow by category first, then by distance.
  // Category filtering happens here rather than inside nearby() so the distance
  // helpers stay pure and know nothing about display concerns.
  const inCategory = useMemo(
    () => (category === 'all' ? library : library.filter((l) => l.category === category)),
    [library, category],
  );

  // 'all' skips the radius filter but keeps the distance sort, so the nearest
  // is still first — you just are not cut off at a boundary.
  const results = useMemo(
    () =>
      scope === 'all'
        ? withDistance(inCategory, origin.lat, origin.lng)
        : nearby(inCategory, origin.lat, origin.lng, scope),
    [inCategory, origin, scope],
  );

  // Changing either filter starts the list again from the top.
  useEffect(() => {
    setShown(PAGE_SIZE);
  }, [scope, category]);

  // The nearest covered area respects the category filter too — offering a
  // museum to someone filtering for markets would not be an answer.
  const nearest = useMemo(
    () => nearestCoveredArea(inCategory, origin.lat, origin.lng),
    [inCategory, origin],
  );

  /** How many cities the filtered library actually reaches. */
  const cityCount = useMemo(
    () => new Set(inCategory.map((l) => l.city).filter(Boolean)).size,
    [inCategory],
  );

  const label = category === 'all' ? null : categoryLabel(category, lang);
  /** "3 heritage landmarks" / "3 landmarks" */
  const noun = (n: number) => `${n} ${label ? `${label.toLowerCase()} ` : ''}landmark${n === 1 ? '' : 's'}`;

  return (
    <div className="flex h-full flex-col">
      {/* Map placeholder */}
      <div className="relative h-[32%] shrink-0">
        <img src="/images/map.svg" alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-bg" />
        <span className="absolute bottom-3 start-gutter label-caps text-muted">
          {/* TODO(C): T-32 — real map with pins. */}
          Map placeholder
        </span>
      </div>

      <div className="scroll-area flex-1 px-gutter pt-4">
        {/* Radius selector */}
        <div
          role="group"
          aria-label="Search radius"
          className="mb-4 inline-flex rounded-full border border-hairline bg-surface p-1"
        >
          {SCOPES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              aria-pressed={scope === s}
              className={[
                'h-touch shrink-0 rounded-full px-5 text-body transition-colors',
                scope === s ? 'bg-accent font-semibold text-white' : 'text-muted',
              ].join(' ')}
            >
              {s === 'all' ? 'All' : `${s} KM`}
            </button>
          ))}
        </div>

        {/* Category filter — works together with the radius above. */}
        <div
          role="group"
          aria-label="Filter by category"
          className="scroll-area -mx-gutter mb-4 flex gap-2 overflow-x-auto px-gutter pb-1"
        >
          <button
            type="button"
            onClick={() => setCategory('all')}
            aria-pressed={category === 'all'}
            className={[
              'h-touch shrink-0 rounded-full border px-4 label-caps transition-colors',
              category === 'all'
                ? 'border-white bg-white text-bg'
                : 'border-hairline bg-surface text-muted',
            ].join(' ')}
          >
            All
          </button>

          {CATEGORIES.map((key) => {
            const active = category === key;
            const color = categoryColor(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => setCategory(key)}
                aria-pressed={active}
                className="h-touch shrink-0 rounded-full border px-4 label-caps transition-colors"
                style={
                  active
                    ? { color: '#0E0E12', backgroundColor: color, borderColor: color }
                    : { color, borderColor: `${color}4D`, backgroundColor: `${color}14` }
                }
              >
                {categoryLabel(key, lang)}
              </button>
            );
          })}
        </div>

        {results.length > 0 ? (
          <>
            <p className="mb-4 text-body text-muted">
              {scope === 'all'
                ? `${noun(results.length)} across ${cityCount} ${cityCount === 1 ? 'city' : 'cities'}`
                : `${noun(results.length)} within ${scope} km`}
            </p>

            <ul className="flex flex-col gap-3">
              {results.slice(0, shown).map(({ landmark, distance_km }) => (
                <li key={landmark.id}>
                  <LandmarkCard landmark={landmark} distanceKm={distance_km} lang={lang} />
                </li>
              ))}
            </ul>

            {/* The whole library is 190 rows. Render a screenful at a time —
                the sort is by distance, so the ones you can actually walk to
                are always at the top. */}
            {shown < results.length && (
              <button
                type="button"
                onClick={() => setShown((n) => n + PAGE_SIZE)}
                className="mt-4 flex h-14 w-full items-center justify-center rounded-ctl
                           border border-hairline bg-surface text-body text-accent-soft"
              >
                Show {Math.min(PAGE_SIZE, results.length - shown)} more
                <span className="ms-2 text-muted">
                  ({shown} of {results.length})
                </span>
              </button>
            )}

            <div className="h-6" />
          </>
        ) : (
          // ── The honest empty state. Name the radius, name the coverage,
          //    point at the nearest covered area. Never pad the list.
          <div className="rounded-sheet border border-hairline bg-surface p-6 text-center">
            <h2 className="mb-2 text-headline text-white">
              No verified {label ? `${label.toLowerCase()} ` : ''}landmarks
              {scope === 'all' ? ' in the library' : ` within ${scope} km`}
            </h2>

            {/* Say which filter came up empty. "Nothing within 5 km" and
                "nothing of this category at all" are different facts, and
                telling the visitor the wrong one sends them walking. */}
            <p className="mb-6 text-body text-muted">
              {inCategory.length === 0
                ? `Our library doesn't cover any ${label?.toLowerCase()} landmarks yet.`
                : `Our library covers ${noun(inCategory.length)} across ${cityCount} ${
                    cityCount === 1 ? 'city' : 'cities'
                  }.`}
            </p>

            {nearest && (
              <button
                type="button"
                onClick={() => navigate(`/story/${nearest.landmark.id}`)}
                className="mb-4 flex w-full items-center justify-between rounded-ctl bg-surface-high p-4 text-start"
              >
                <span>
                  <span className="block text-body text-white">
                    {(lang === 'ar' ? nearest.landmark.name_ar : nearest.landmark.name_en) ||
                      nearest.landmark.name_en}
                  </span>
                  <span className="label-caps text-sand">
                    {nearest.landmark.city ? `${nearest.landmark.city} · ` : ''}
                    {formatDistance(nearest.distance_km)}
                  </span>
                </span>
                <span aria-hidden="true" className="text-muted">→</span>
              </button>
            )}

            {/* When a category filter is on, lifting it is usually the fix —
                offer it before sending anyone 20 km across the city. */}
            {category !== 'all' && (
              <button
                type="button"
                onClick={() => setCategory('all')}
                className="mb-3 flex h-14 w-full items-center justify-center rounded-ctl bg-accent
                           text-body-lg font-semibold text-white"
              >
                Show all categories
              </button>
            )}

            {/* Widening the radius only helps while there is a radius to
                widen. On 'all' there is nowhere further to look. */}
            {scope !== 'all' && (
              <button
                type="button"
                onClick={() => setScope('all')}
                className={[
                  'flex h-14 w-full items-center justify-center rounded-ctl text-body-lg',
                  category === 'all'
                    ? 'bg-accent font-semibold text-white'
                    : 'border border-accent/60 text-accent-soft',
                ].join(' ')}
              >
                Show every landmark
              </button>
            )}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
