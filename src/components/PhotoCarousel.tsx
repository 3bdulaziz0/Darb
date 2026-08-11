/**
 * OWNER: teammate C.
 *
 * DONE:  swipe or tap through a landmark's reference photographs, with arrows,
 *        dots, keyboard support and a counter.
 * TODO:  nothing.
 *
 * Arrows are mirrored automatically in Arabic: the control that means "next"
 * sits on the side the language reads towards, because it uses `start`/`end`
 * rather than left/right. The photo order never changes — only the buttons
 * swap sides.
 */

import { useEffect, useRef, useState } from 'react';
import { useLang } from '../lib/i18n';
import { PHOTO_PENDING } from './LandmarkCard';

function ChevronIcon({ back }: { back?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`h-6 w-6 ${back ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export default function PhotoCarousel({ images, alt = '' }: { images: string[]; alt?: string }) {
  const { lang } = useLang();
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const count = images.length;
  const rtl = lang === 'ar';

  // A shorter list than before must not leave us pointing past the end.
  useEffect(() => {
    setIndex((i) => (i < count ? i : 0));
  }, [count]);

  if (count === 0) {
    return <img src={PHOTO_PENDING} alt="" className="h-full w-full object-cover" />;
  }

  const go = (delta: number) => setIndex((i) => (i + delta + count) % count);
  const next = () => go(1);
  const previous = () => go(-1);

  return (
    <div
      className="relative h-full w-full"
      role="group"
      aria-roledescription="carousel"
      aria-label={lang === 'ar' ? 'صور المعلم' : 'Landmark photos'}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        const start = touchStartX.current;
        touchStartX.current = null;
        if (start === null) return;
        const dx = e.changedTouches[0].clientX - start;
        // Ignore anything that reads more like a tap than a swipe.
        if (Math.abs(dx) < 40) return;
        // Swiping left always advances in LTR; in RTL it is the mirror.
        go(rtl ? (dx < 0 ? -1 : 1) : dx < 0 ? 1 : -1);
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(rtl ? -1 : 1);
        if (e.key === 'ArrowLeft') go(rtl ? 1 : -1);
      }}
      tabIndex={0}
    >
      {/* One <img> that swaps source keeps memory flat on a phone; the
          neighbours are preloaded so a swipe never shows a blank frame. */}
      <img
        src={images[index]}
        alt={alt}
        onError={(e) => {
          e.currentTarget.src = PHOTO_PENDING;
        }}
        className="h-full w-full object-cover"
      />
      <div className="hidden">
        {[images[(index + 1) % count], images[(index - 1 + count) % count]].map((src) => (
          <img key={src} src={src} alt="" />
        ))}
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={previous}
            aria-label={lang === 'ar' ? 'الصورة السابقة' : 'Previous photo'}
            className="control glass absolute start-2 top-1/2 -translate-y-1/2 text-white"
          >
            <ChevronIcon back />
          </button>

          <button
            type="button"
            onClick={next}
            aria-label={lang === 'ar' ? 'الصورة التالية' : 'Next photo'}
            className="control glass absolute end-2 top-1/2 -translate-y-1/2 text-white"
          >
            <ChevronIcon />
          </button>

          {/* Counter, in the corner away from the back button. */}
          <span className="absolute end-3 top-3 rounded-full bg-black/50 px-2.5 py-1 label-caps
                           text-white backdrop-blur-glass">
            {index + 1} / {count}
          </span>

          {/* Dots sit above the sheet so they stay visible. */}
          <div className="absolute inset-x-0 bottom-[42%] flex justify-center gap-1.5">
            {images.map((src, i) => (
              <button
                key={src}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`${lang === 'ar' ? 'صورة' : 'Photo'} ${i + 1}`}
                aria-current={i === index}
                className={[
                  'h-1.5 rounded-full transition-all',
                  i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/50',
                ].join(' ')}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
