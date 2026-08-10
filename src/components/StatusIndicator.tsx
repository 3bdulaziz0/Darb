/**
 * OWNER: teammate A (T-21).
 *
 * DONE:  the three-stage vertical indicator from design/identifying_landmark,
 *        bilingual, with a title and a cancel action.
 * TODO:  timeout messaging — no stage may sit longer than 4s without saying
 *        something (Epic 5). Wire that to the real recognize() call.
 *
 * Defaults to Arabic, which is the product's primary content language. Pass
 * lang="en" for the English labels; the layout flips on its own because the
 * whole component uses logical properties.
 */

import type { Lang, Stage } from '../lib/types';

const TITLE = { ar: 'جارٍ التعرّف...', en: 'Identifying…' };

const STAGES: { key: Stage; ar: string; en: string }[] = [
  { key: 'locating', ar: 'تحديد موقعك', en: 'Locating you' },
  { key: 'matching', ar: 'مطابقة المعلم', en: 'Matching landmark' },
  { key: 'fetching', ar: 'جلب القصة', en: 'Fetching the story' },
];

const CANCEL = { ar: 'إلغاء', en: 'Cancel' };

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

export default function StatusIndicator({
  stage,
  onCancel,
  lang = 'ar',
}: {
  stage: Stage;
  onCancel?: () => void;
  lang?: Lang;
}) {
  const activeIndex = STAGES.findIndex((s) => s.key === stage);

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col justify-center"
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <h2 className="mb-10 px-gutter text-headline text-white">{TITLE[lang]}</h2>

      <ol className="flex flex-col gap-8 px-gutter">
        {STAGES.map((s, i) => {
          const done = i < activeIndex;
          const active = i === activeIndex;

          return (
            <li key={s.key} className="relative flex items-center gap-5">
              {/* connector to the next stage */}
              {i < STAGES.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute start-[27px] top-14 h-8 w-px bg-hairline"
                />
              )}

              <span
                className={[
                  'flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2',
                  done ? 'border-accent bg-accent text-white' : '',
                  active ? 'border-accent bg-transparent text-accent' : '',
                  !done && !active ? 'border-hairline bg-transparent text-muted/50' : '',
                ].join(' ')}
              >
                {done ? (
                  <CheckIcon />
                ) : (
                  <span
                    className={[
                      'block rounded-full',
                      active ? 'h-4 w-4 animate-pulse bg-accent' : 'h-2.5 w-2.5 bg-muted/40',
                    ].join(' ')}
                  />
                )}
              </span>

              <span
                className={[
                  active ? 'text-headline text-white' : 'text-body-lg',
                  done ? 'text-white/70' : '',
                  !done && !active ? 'text-muted/60' : '',
                ].join(' ')}
              >
                {lang === 'ar' ? s.ar : s.en}
              </span>
            </li>
          );
        })}
      </ol>

      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="absolute bottom-10 start-0 end-0 mx-auto h-touch w-fit px-8 label-caps
                     text-muted transition-colors hover:text-white"
        >
          {CANCEL[lang]}
        </button>
      )}
    </div>
  );
}
