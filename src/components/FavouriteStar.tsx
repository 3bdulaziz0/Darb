/**
 * OWNER: teammate C.
 *
 * DONE:  the star toggle, shared by the discovery row and the story sheet.
 * TODO:  nothing.
 *
 * Every star on screen listens to the same store, so tapping one in the list
 * updates the one on the story page and vice versa.
 */

import { useEffect, useState } from 'react';
import { isFavourite, onFavouritesChanged, toggleFavourite } from '../lib/favourites';
import { useLang } from '../lib/i18n';

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinejoin="round"
    >
      <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z" />
    </svg>
  );
}

export default function FavouriteStar({
  landmarkId,
  className = '',
}: {
  landmarkId: string;
  className?: string;
}) {
  const { lang } = useLang();
  const [on, setOn] = useState(() => isFavourite(landmarkId));

  useEffect(() => {
    setOn(isFavourite(landmarkId));
    return onFavouritesChanged(() => setOn(isFavourite(landmarkId)));
  }, [landmarkId]);

  const label = on
    ? lang === 'ar'
      ? 'إزالة من المفضلة'
      : 'Remove from favourites'
    : lang === 'ar'
      ? 'إضافة إلى المفضلة'
      : 'Add to favourites';

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      title={label}
      onClick={(e) => {
        // The star usually sits inside a link to the story page — starring
        // something must not also navigate to it.
        e.preventDefault();
        e.stopPropagation();
        setOn(toggleFavourite(landmarkId));
      }}
      className={[
        'control shrink-0 transition-colors',
        on ? 'text-sand' : 'text-muted hover:text-white',
        className,
      ].join(' ')}
    >
      <StarIcon filled={on} />
    </button>
  );
}
