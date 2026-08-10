/**
 * OWNER: teammate C (T-31).
 *
 * DONE:  the discovery list row from design/nearby_landmarks — thumbnail,
 *        name, distance in heritage sand, directions handoff.
 * TODO:  the directions button is inert. Wire it to an external maps URL
 *        (T-34). There is no in-app routing, by scope.
 *
 * RULE 1: this card shows a name and a distance. Never add a subtitle that
 * summarises the landmark's history — that would be an unsourced fact.
 */

import { Link } from 'react-router-dom';
import type { Lang, Landmark } from '../lib/types';
import { formatDistance } from '../lib/library';

/** Shown wherever a landmark's photo has not been taken yet. */
export const PHOTO_PENDING = '/images/placeholder.jpg';

function DirectionsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3 20 21l-8-4-8 4Z" />
    </svg>
  );
}

export default function LandmarkCard({
  landmark,
  distanceKm,
  lang,
}: {
  landmark: Landmark;
  /** Omitted when location was denied — distances are hidden, never estimated. */
  distanceKm?: number;
  lang: Lang;
}) {
  // Most of the library is not translated yet. Fall back to the language we
  // have rather than rendering a blank row.
  const name = (lang === 'ar' ? landmark.name_ar : landmark.name_en) || landmark.name_en;
  const otherName = lang === 'ar' ? landmark.name_en : landmark.name_ar;

  // The list now spans 19 cities, so where a landmark is matters as much as
  // what it is called. City first — it is the part that orients you, and for
  // an untranslated entry it is all this line would otherwise hold.
  const secondary = [landmark.city, otherName].filter(Boolean).join(' · ');

  return (
    <Link
      to={`/story/${landmark.id}`}
      className="flex items-center gap-4 rounded-sheet border border-hairline bg-surface p-3
                 transition-colors hover:bg-surface-high"
    >
      <img
        src={landmark.image}
        alt=""
        loading="lazy"
        // Most library photos have not been shot yet.
        onError={(e) => {
          e.currentTarget.src = PHOTO_PENDING;
        }}
        className="h-16 w-16 shrink-0 rounded-ctl object-cover"
      />

      <div className="min-w-0 flex-1">
        <h3 className="truncate text-body-lg font-semibold text-white">{name}</h3>
        <p className="truncate text-caption text-muted">{secondary}</p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        {distanceKm !== undefined && (
          <span className="label-caps text-sand">{formatDistance(distanceKm)}</span>
        )}
        <span
          className="control h-touch w-touch border border-hairline bg-surface-high text-muted"
          aria-hidden="true"
        >
          <DirectionsIcon />
        </span>
      </div>
    </Link>
  );
}
