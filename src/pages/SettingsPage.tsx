/**
 * OWNER: teammate C (T-18, T-19).
 *
 * DONE:  the settings sheet from design/settings_bottom_sheet — language
 *        toggle, voice list, reading speed, permissions row. Local state only.
 * TODO:  1. Language toggle must switch the whole interface AND set
 *           <html lang dir> — that alone flips the layout, because every
 *           component uses logical properties (T-18).
 *        2. Voices come from speechSynthesis.getVoices(), filtered by
 *           language, with a preview tap. Fall back silently to the system
 *           default if a voice fails (T-19).
 *        3. Reading speed feeds SpeechSynthesisUtterance.rate.
 *        4. The permissions row should deep-link to the browser's site
 *           settings, or show the repair instructions inline.
 *
 * Nothing here persists beyond the session — the MVP has no accounts and no
 * storage, by scope.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLang } from '../lib/i18n';
import { MOCK_VOICES } from '../lib/mockData';

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="currentColor">
      <path d="M8 5.5v13l11-6.5-11-6.5Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5"
         fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();

  // Language is real app state now — changing it here flips the whole
  // interface and the document direction immediately.
  const { lang, setLang, t } = useLang();
  const [voiceId, setVoiceId] = useState<string>(MOCK_VOICES[0].id);
  const [speed, setSpeed] = useState(1);

  return (
    <div className="flex h-full flex-col justify-end">
      {/* Scrim — tapping it closes the sheet. */}
      <button
        type="button"
        aria-label={t('settings')}
        onClick={() => navigate(-1)}
        className="flex-1 bg-black/40"
      />

      <section className="scroll-area max-h-[88%] rounded-t-sheet bg-surface pb-8">
        <div className="flex justify-center pb-2 pt-4">
          <span className="h-1.5 w-12 rounded-full bg-muted/30" />
        </div>

        <div className="px-gutter">
          <h1 className="mb-8 text-display text-white">{t('settings')}</h1>

          {/* Language */}
          <div className="mb-6 flex items-center justify-between gap-4">
            <span className="text-body-lg text-white">{t('language')}</span>
            <div className="inline-flex rounded-full border border-hairline bg-surface-high p-1">
              {(['ar', 'en'] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  aria-pressed={lang === code}
                  className={[
                    'h-touch rounded-full px-5 text-body transition-colors',
                    lang === code ? 'bg-accent font-semibold text-white' : 'text-muted',
                  ].join(' ')}
                >
                  {code === 'ar' ? 'العربية' : 'English'}
                </button>
              ))}
            </div>
          </div>

          <hr className="mb-6 border-hairline" />

          {/* Voice */}
          <h2 className="mb-4 text-body-lg text-muted">{t('narrationVoice')}</h2>
          <ul className="mb-8 flex flex-col gap-3">
            {MOCK_VOICES.map((voice) => {
              const selected = voice.id === voiceId;
              return (
                <li key={voice.id}>
                  <button
                    type="button"
                    onClick={() => setVoiceId(voice.id)}
                    aria-pressed={selected}
                    className={[
                      'flex w-full items-center gap-4 rounded-ctl border p-3 text-start transition-colors',
                      selected ? 'border-accent bg-accent/10' : 'border-transparent',
                    ].join(' ')}
                  >
                    <span className="control border border-hairline bg-surface-high text-white">
                      <PlayIcon />
                    </span>
                    <span
                      className={[
                        'text-body-lg',
                        selected ? 'font-semibold text-white' : 'text-muted',
                      ].join(' ')}
                    >
                      {voice.name}
                    </span>
                    <span className="rounded bg-surface-highest px-2 py-1 label-caps text-muted">
                      {voice.lang}
                    </span>
                    {selected && <span className="ms-auto text-accent-soft"><CheckIcon /></span>}
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Reading speed */}
          <h2 className="mb-4 text-body-lg text-muted">{t('readingSpeed')}</h2>
          <input
            type="range"
            min={0.5}
            max={1.5}
            step={0.25}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            aria-label={t('readingSpeed')}
            className="mb-2 h-touch w-full accent-accent"
          />
          <div className="mb-8 flex justify-between text-caption text-muted">
            <span>{t('slow')}</span>
            <span>{t('normal')}</span>
            <span>{t('fast')}</span>
          </div>

          <hr className="mb-2 border-hairline" />

          {/* Permissions */}
          <button
            type="button"
            disabled
            className="flex h-touch w-full items-center justify-between text-start text-body-lg text-white
                       disabled:opacity-70"
          >
            {t('permissions')}
            <span aria-hidden="true" className="text-muted rtl:rotate-180">›</span>
          </button>
        </div>
      </section>
    </div>
  );
}
