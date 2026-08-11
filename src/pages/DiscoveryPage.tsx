/**
 * OWNER: teammate C (T-31, T-32, T-33, T-34).
 *
 * DONE:  the discovery screen from design/nearby_landmarks and
 *        design/empty_discovery_state — live map with the visitor's position
 *        and a pin per landmark (T-32), real geolocation as the distance
 *        origin (T-29), scope selector, distance-sorted list with progressive
 *        loading (T-31), honest empty state, maps handoff per row (T-34).
 * TODO:  manual area selection when location is refused. Today the list still
 *        works without a fix — it simply shows no distances — which is the
 *        behaviour the PRD asks for, but not yet the UI.
 *
 * RULE 1: the list shows curated library entries only. When the radius is
 * empty, say so — do not pad the list with uncurated places.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import LandmarkCard from '../components/LandmarkCard';
import LandmarkMap from '../components/LandmarkMap';
import SettingsIcon from '../components/SettingsIcon';
import { CATEGORIES, categoryColor, categoryLabel } from '../lib/categories';
import {
  formatDistance,
  loadLandmarks,
  nearby,
  nearestCoveredArea,
  withDistance,
} from '../lib/library';
import { useLang } from '../lib/i18n';
import { favouriteCount, isFavourite, onFavouritesChanged } from '../lib/favourites';
import { getPosition } from '../lib/location';
import type { Category, Coordinates, DiscoveryScope, Landmark } from '../lib/types';

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

function BottomNav() {
  const { t } = useLang();
  return (
    <nav className="flex shrink-0 items-center justify-around border-t border-hairline bg-surface px-gutter py-3">
      <span aria-current="page" className="control bg-accent text-white">
        <CompassIcon />
      </span>
      <Link to="/" aria-label={t('camera')} className="control border border-hairline text-muted">
        <ShutterIcon />
      </Link>
      <Link to="/settings" aria-label={t('settings')} className="control border border-hairline text-muted">
        <SettingsIcon />
      </Link>
    </nav>
  );
}

export default function DiscoveryPage() {
  const navigate = useNavigate();
  const { lang, t } = useLang();

  const [library, setLibrary] = useState<Landmark[]>([]);
  // Opens on the whole library rather than a radius. The library reaches 19
  // cities, and a visitor is usually far from most of them — starting at 5 km
  // showed four landmarks and made the app look almost empty. The distance
  // sort still puts whatever is nearby at the top, so nothing is lost by
  // starting wide, and the radius chips are there to narrow it.
  const [scope, setScope] = useState<DiscoveryScope>('all');
  // 'favourites' is a filter, not a place type, so it is not in the Category
  // union — it sits alongside it here and nowhere else.
  const [category, setCategory] = useState<Category | 'all' | 'favourites'>('all');
  const [starred, setStarred] = useState(favouriteCount);

  // Unstarring the last favourite while looking at the favourites list should
  // update the list, not strand the visitor on a stale one.
  useEffect(() => onFavouritesChanged(() => setStarred(favouriteCount())), []);
  /** How many rows are on screen. Grows in PAGE_SIZE steps, never all at once. */
  const [shown, setShown] = useState(PAGE_SIZE);

  /**
   * The visitor's real position (T-29).
   *
   * Without it we do not invent one. Distances vanish rather than being
   * measured from a guess, because a wrong distance sends someone walking.
   */
  const [position, setPosition] = useState<
    { state: 'acquiring' } | { state: 'ready'; coords: Coordinates } | { state: 'off' }
  >({ state: 'acquiring' });

  useEffect(() => {
    let live = true;
    void getPosition().then((result) => {
      if (!live) return;
      setPosition(result.ok ? { state: 'ready', coords: result } : { state: 'off' });
    });
    return () => {
      live = false;
    };
  }, []);

  const coords = position.state === 'ready' ? position.coords : null;

  useEffect(() => {
    void loadLandmarks().then(setLibrary);
  }, []);

  // Both filters apply at once: narrow by category first, then by distance.
  // Category filtering happens here rather than inside nearby() so the distance
  // helpers stay pure and know nothing about display concerns.
  const inCategory = useMemo(() => {
    if (category === 'all') return library;
    if (category === 'favourites') return library.filter((l) => isFavourite(l.id));
    return library.filter((l) => l.category === category);
    // `starred` is in the deps so the list re-filters the moment a star is
    // tapped — isFavourite reads a module store React cannot see on its own.
  }, [library, category, starred]);

  // 'all' skips the radius filter but keeps the distance sort, so the nearest
  // is still first — you just are not cut off at a boundary.
  //
  // Then the landmarks the camera can actually identify are pinned to the top.
  // Those are the ones where the product does what it promises, so they should
  // be what a visitor meets first; everything else stays in distance order
  // beneath them. Each pinned row carries a badge, so the ordering is visible
  // rather than mysterious.
  const results = useMemo((): { landmark: Landmark; distance_km: number | null }[] => {
    // No position means no radius and no distances — only the order we can
    // still justify, which is the ones the camera can identify first.
    if (!coords) {
      return [...inCategory]
        .sort((a, b) => Number(Boolean(b.test_ready)) - Number(Boolean(a.test_ready)))
        .map((landmark) => ({ landmark, distance_km: null }));
    }

    // Favourites ignore the radius on purpose. You starred a place because you
    // mean to go there, not because it is nearby — a list that hides the thing
    // you saved is not a favourites list. Distances still show, so how far it
    // is remains visible.
    const ignoreRadius = scope === 'all' || category === 'favourites';
    const list = ignoreRadius
      ? withDistance(inCategory, coords.lat, coords.lng)
      : nearby(inCategory, coords.lat, coords.lng, scope);

    return [...list].sort(
      (a, b) =>
        Number(Boolean(b.landmark.test_ready)) - Number(Boolean(a.landmark.test_ready)) ||
        a.distance_km - b.distance_km,
    );
  }, [inCategory, coords, scope, category]);

  // Changing either filter starts the list again from the top.
  useEffect(() => {
    setShown(PAGE_SIZE);
  }, [scope, category]);

  // The nearest covered area respects the category filter too — offering a
  // museum to someone filtering for markets would not be an answer.
  const nearest = useMemo(
    () => (coords ? nearestCoveredArea(inCategory, coords.lat, coords.lng) : null),
    [inCategory, coords],
  );

  /** How many cities the filtered library actually reaches. */
  const cityCount = useMemo(
    () => new Set(inCategory.map((l) => l.city).filter(Boolean)).size,
    [inCategory],
  );

  const label =
    category === 'all'
      ? null
      : category === 'favourites'
        ? lang === 'ar'
          ? 'المفضلة'
          : 'Favourites'
        : categoryLabel(category, lang);

  /**
   * "3 heritage landmarks" · "٣ معالم · تراثي"
   *
   * Arabic counts do not pluralise the way English does — 1 takes the
   * singular, 2 a dual, 3–10 a plural, and 11+ the singular again in the
   * accusative. The category is appended as a separate qualifier rather than
   * an adjective, which sidesteps gender agreement entirely and still reads
   * naturally.
   */
  const noun = (n: number) => {
    if (lang === 'en') {
      return `${n} ${label ? `${label.toLowerCase()} ` : ''}landmark${n === 1 ? '' : 's'}`;
    }
    const word =
      n === 1 ? 'معلم واحد' : n === 2 ? 'معلمان' : n <= 10 ? `${n} معالم` : `${n} معلمًا`;
    return label ? `${word} · ${label}` : word;
  };

  /** "4 landmarks within 5 km" · "٤ معالم ضمن ٥ كم" */
  const summary = (n: number) => {
    // Without a position there is no radius to speak of, so the sentence must
    // not imply one.
    if (!coords || scope === 'all' || category === 'favourites') {
      return lang === 'ar'
        ? `${noun(n)} في ${cityCount} ${cityCount === 1 ? 'مدينة' : 'مدن'}`
        : `${noun(n)} across ${cityCount} ${cityCount === 1 ? 'city' : 'cities'}`;
    }
    return lang === 'ar' ? `${noun(n)} ضمن ${scope} كم` : `${noun(n)} within ${scope} km`;
  };

  return (
    <div className="flex h-full flex-col">
      {/* The map shows exactly what the list shows, so the two can never
          disagree. Tapping a pin opens that landmark's story. */}
      <div className="relative h-[32%] shrink-0">
        <LandmarkMap
          landmarks={results.map((r) => r.landmark)}
          origin={coords}
          className="h-full w-full"
        />

        {position.state !== 'ready' && (
          <span className="pointer-events-none absolute bottom-2 start-gutter z-[500] rounded-full
                           bg-black/60 px-3 py-1 label-caps text-sand backdrop-blur-glass">
            {position.state === 'acquiring' ? t('locating') : t('locationOff')}
          </span>
        )}
      </div>

      <div className="scroll-area flex-1 px-gutter pt-4">
        {/* Radius selector */}
        <div
          role="group"
          aria-label={t('searchRadius')}
          className="mb-4 inline-flex rounded-full border border-hairline bg-surface p-1"
        >
          {SCOPES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              aria-pressed={scope === s}
              // A radius needs somewhere to measure from. Rather than filter
              // by a number that means nothing, the chips wait for a fix.
              disabled={!coords && s !== 'all'}
              className={[
                'h-touch shrink-0 rounded-full px-5 text-body transition-colors',
                scope === s ? 'bg-accent font-semibold text-white' : 'text-muted',
                !coords && s !== 'all' ? 'opacity-40' : '',
              ].join(' ')}
            >
              {s === 'all' ? t('all') : `${s} ${lang === 'ar' ? 'كم' : 'KM'}`}
            </button>
          ))}
        </div>

        {/* Category filter — works together with the radius above. */}
        <div
          role="group"
          aria-label={t('filterByCategory')}
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
            {t('all')}
          </button>

          {/* Favourites. Shown even when empty, so the star has somewhere
              obvious to lead once you use it. */}
          <button
            type="button"
            onClick={() => setCategory('favourites')}
            aria-pressed={category === 'favourites'}
            className={[
              'flex h-touch shrink-0 items-center gap-1.5 rounded-full border px-4 label-caps transition-colors',
              category === 'favourites'
                ? 'border-sand bg-sand text-bg'
                : 'border-sand/40 bg-sand/10 text-sand',
            ].join(' ')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5" fill="currentColor">
              <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z" />
            </svg>
            {lang === 'ar' ? 'المفضلة' : 'Favourites'}
            {starred > 0 && <span className="opacity-70">{starred}</span>}
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
              {summary(results.length)}
            </p>

            <ul className="flex flex-col gap-3">
              {results.slice(0, shown).map(({ landmark, distance_km }) => (
                <li key={landmark.id}>
                  <LandmarkCard
                    landmark={landmark}
                    distanceKm={distance_km ?? undefined}
                    lang={lang}
                  />
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
                {t('showMore')}
                <span className="ms-2 text-muted">
                  ({shown} / {results.length})
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
              {lang === 'ar'
                ? `لا توجد معالم موثّقة${label ? ` من تصنيف ${label}` : ''} ${
                    scope === 'all' ? t('noneInLibrary') : `ضمن ${scope} كم`
                  }`
                : `No verified ${label ? `${label.toLowerCase()} ` : ''}landmarks ${
                    scope === 'all' ? t('noneInLibrary') : `within ${scope} km`
                  }`}
            </h2>

            {/* Say which filter came up empty. "Nothing within 5 km" and
                "nothing of this category at all" are different facts, and
                telling the visitor the wrong one sends them walking. */}
            <p className="mb-6 text-body text-muted">
              {category === 'favourites' && starred === 0
                ? lang === 'ar'
                  ? 'اضغط النجمة عند أي معلم لإضافته هنا.'
                  : 'Tap the star on any landmark to add it here.'
                : inCategory.length === 0
                ? lang === 'ar'
                  ? `مكتبتنا لا تغطي أي معالم من تصنيف ${label} حتى الآن.`
                  : `Our library doesn't cover any ${label?.toLowerCase()} landmarks yet.`
                : lang === 'ar'
                  ? `مكتبتنا تغطي ${noun(inCategory.length)} في ${cityCount} ${
                      cityCount === 1 ? 'مدينة' : 'مدن'
                    }.`
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
                    {formatDistance(nearest.distance_km, lang)}
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
                {t('showAllCategories')}
              </button>
            )}

            {/* Widening the radius only helps while there is a radius to
                widen — never on 'all', and never in favourites, where the
                radius is not what is holding the list back. */}
            {scope !== 'all' && category !== 'favourites' && (
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
                {t('showEveryLandmark')}
              </button>
            )}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
