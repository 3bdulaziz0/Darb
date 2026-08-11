/**
 * OWNER: teammate C (T-17, T-18, T-19, T-20, T-22, T-26).
 *
 * DONE:  the story sheet from design/landmark_story — hero image, bottom
 *        sheet, name, element chips, voice player shell, sourced facts,
 *        nearby rail, follow-up input.
 * TODO:  1. Voice playback — SpeechSynthesis, play/pause, real progress (T-19).
 *        2. The follow-up input is inert. Answers must be bounded by THIS
 *           landmark's facts; anything else returns "not in our sources" (T-20).
 *        3. Nearby rail reads the whole library. Sort it by real distance from
 *           the user once geolocation exists (T-22).
 *        4. Language toggle (T-18) — swap `lang` for real i18n state.
 *
 * RULE 1: every string on this page comes from landmarks.json or is UI chrome.
 * RULE 2: facts render through <SourcedFact/> only. You cannot render one
 *         without its badge — see lib/types.ts.
 *
 * NOTE ON THE DESIGN: the mock shows "BUILT 1872" and "GOTHIC STYLE" chips.
 * Those are historical claims with no source attached, so they are not built.
 * The chips below show architectural elements from the library instead.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { SourceBadge, SourcedFact } from '../components/SourceBadge';
import { PHOTO_PENDING } from '../components/LandmarkCard';
import FavouriteStar from '../components/FavouriteStar';
import PhotoCarousel from '../components/PhotoCarousel';
import { categoryColor, categoryLabel } from '../lib/categories';
import { getLandmark, loadLandmarks, mapsUrl, sealFacts, withDistance } from '../lib/library';
import { useLang } from '../lib/i18n';
import { MOCK_ELEMENT_LABELS } from '../lib/mockData';
import { ask } from '../lib/recognize';
import { isSpeechAvailable, speak, stopSpeaking } from '../lib/speech';
import { getRate, getVoiceId } from '../lib/narration';
import { findVoice, voiceLabel, voicesFor } from '../lib/voices';
import type { Landmark, SealedFact } from '../lib/types';

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 rtl:rotate-180"
         fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="currentColor">
      <path d="M8 5.5v13l11-6.5-11-6.5Z" />
    </svg>
  );
}

function DirectionsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5"
         fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round">
      <path d="M12 3 20 21l-8-4-8 4Z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function VoiceIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5"
         fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
      <path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2" />
    </svg>
  );
}

export default function StoryPage() {
  const { id } = useParams<{ id: string }>();
  const { lang, t } = useLang();

  // The frame the visitor just captured, when they arrived from the camera.
  // Opened from the discovery list there is none, and we show the library
  // photo instead.
  const capture = (useLocation().state ?? {}) as { capture?: { image: string } };
  const capturedImage = capture.capture?.image ?? null;

  const [landmark, setLandmark] = useState<Landmark | null>(null);
  const [facts, setFacts] = useState<SealedFact[]>([]);
  const [nearby, setNearby] = useState<Landmark[]>([]);
  const [missing, setMissing] = useState(false);

  const [speaking, setSpeaking] = useState(false);
  /** 'preparing' while the model generates the audio — it is not instant. */
  const [preparingAudio, setPreparingAudio] = useState(false);
  /** Set when the model could not be reached and the device voice stood in. */
  const [usedDeviceVoice, setUsedDeviceVoice] = useState(false);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<
    | { kind: 'covered'; text: string; fact_indexes: number[] }
    | { kind: 'uncovered' }
    | { kind: 'failed' }
    | null
  >(null);
  const answerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    let live = true;

    void (async () => {
      const found = await getLandmark(id);
      if (!live) return;

      if (!found) {
        // An id we cannot resolve is a miss, not a blank page.
        setMissing(true);
        return;
      }

      setLandmark(found);
      setFacts(sealFacts(found));

      // Up to 3 nearest, measured from the landmark you are reading about
      // (Epic 5). The library spans 19 cities now — without the cap this rail
      // would render every entry we have.
      const all = await loadLandmarks();
      if (live) {
        setNearby(
          withDistance(all, found.lat, found.lng)
            .filter((r) => r.landmark.id !== found.id)
            .slice(0, 3)
            .map((r) => r.landmark),
        );
      }
    })();

    return () => {
      live = false;
    };
  }, [id]);

  // Read aloud exactly the sourced facts already on screen, joined. Nothing
  // is written for narration, so nothing can be invented into it.
  const narration = useMemo(
    () =>
      facts
        .map((f) => (lang === 'ar' ? f.text_ar.text : f.text_en.text) || f.text_en.text)
        .filter(Boolean)
        .join(' '),
    [facts, lang],
  );

  // Every photo we hold of this landmark, best one first. `image` is already
  // the first reference photo when there are any, so it is only added when
  // there are none.
  const gallery = useMemo(() => {
    const refs = landmark?.reference_images ?? [];
    if (refs.length) return refs;
    return landmark?.image ? [landmark.image] : [];
  }, [landmark]);

  const activeVoice = findVoice(getVoiceId(lang)) ?? voicesFor(lang)[0];

  // Never leave a voice talking after the visitor has moved on.
  useEffect(() => stopSpeaking, []);

  async function toggleSpeech() {
    if (speaking || preparingAudio) {
      stopSpeaking();
      setSpeaking(false);
      setPreparingAudio(false);
      return;
    }

    setPreparingAudio(true);
    setUsedDeviceVoice(false);
    try {
      const handle = await speak({
        text: narration,
        lang,
        voiceId: getVoiceId(lang),
        rate: getRate(),
        onEnd: () => setSpeaking(false),
      });
      setUsedDeviceVoice(handle.source === 'device');
      setSpeaking(true);
    } finally {
      setPreparingAudio(false);
    }
  }

  async function submitQuestion(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || !landmark || asking) return;

    setAsking(true);
    setAnswer(null);
    try {
      const result = await ask(landmark.id, q, lang);
      setAnswer(
        result.covered
          ? { kind: 'covered', text: result.answer, fact_indexes: result.fact_indexes }
          : { kind: 'uncovered' },
      );
      setQuestion('');
    } catch {
      setAnswer({ kind: 'failed' });
    } finally {
      setAsking(false);
      requestAnimationFrame(() => answerRef.current?.scrollIntoView({ behavior: 'smooth' }));
    }
  }

  if (missing) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 px-gutter text-center">
        <p className="text-headline text-white">{t('notInLibrary')}</p>
        <Link to="/" className="flex h-touch items-center rounded-ctl bg-accent px-6 text-body font-semibold">
          {t('backToCamera')}
        </Link>
      </div>
    );
  }

  if (!landmark) {
    return <div className="flex h-full items-center justify-center text-muted">{t('loading')}</div>;
  }

  // Falls back to the language we have — most of the library is English-only
  // until teammate D's translation pass (T-2).
  const name = (lang === 'ar' ? landmark.name_ar : landmark.name_en) || landmark.name_en;
  const secondary = lang === 'ar' ? landmark.name_en : landmark.name_ar;

  return (
    <div className="relative h-full w-full">
      {/* Hero */}
      <div className="absolute inset-x-0 top-0 h-[45%]">
        {capturedImage ? (
          // The frame the visitor just took wins: it is what they are looking
          // at, and it is the evidence for the match.
          <img
            src={capturedImage}
            alt=""
            onError={(e) => {
              e.currentTarget.src = PHOTO_PENDING;
            }}
            className="h-full w-full object-cover"
          />
        ) : (
          <PhotoCarousel images={gallery} alt={name} />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 to-transparent" />
      </div>

      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between p-gutter">
        <Link to="/" aria-label={t('back')} className="control glass text-white">
          <BackIcon />
        </Link>

        <div className="flex items-center gap-2">
          <FavouriteStar landmarkId={landmark.id} className="glass" />
          <a
            href={mapsUrl(landmark)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={lang === 'ar' ? 'الاتجاهات في خرائط قوقل' : 'Directions in Google Maps'}
            className="control glass text-white"
          >
            <DirectionsIcon />
          </a>
        </div>
      </div>

      {/* Sheet */}
      <section className="absolute inset-x-0 bottom-0 top-[38%] z-10 flex flex-col rounded-t-sheet bg-surface">
        <div className="flex shrink-0 justify-center pb-2 pt-4">
          <span className="h-1.5 w-12 rounded-full bg-muted/30" />
        </div>

        <div className="scroll-area flex-1 px-gutter pb-10">
          <header className="mb-6">
            <h1 className="text-display text-white">{name}</h1>
            <p className="mb-3 text-body-lg text-muted">{secondary}</p>

            {/* What kind of place this is. A shelf label, not a claim about
                the building's history — so no source badge belongs here. */}
            <span
              className="inline-flex h-8 items-center rounded border px-3 label-caps"
              style={{
                color: categoryColor(landmark.category),
                borderColor: `${categoryColor(landmark.category)}4D`, // 30% alpha
                backgroundColor: `${categoryColor(landmark.category)}1A`, // 10% alpha
              }}
            >
              {categoryLabel(landmark.category, lang)}
            </span>
          </header>

          {/* Architectural elements — library data, not historical claims. */}
          {landmark.elements.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {landmark.elements.map((key) => (
                <span
                  key={key}
                  className="flex h-8 items-center rounded border border-sand/30 bg-sand/10 px-3
                             label-caps text-sand"
                >
                  {MOCK_ELEMENT_LABELS[key] ?? key}
                </span>
              ))}
            </div>
          )}

          {/* Voice player — shell only. TODO(C): T-19. */}
          <div className="mb-8 flex items-center gap-4 rounded-ctl border border-hairline bg-surface-high/60 p-4">
            <button
              type="button"
              onClick={() => void toggleSpeech()}
              disabled={!isSpeechAvailable() || !narration}
              aria-label={speaking || preparingAudio ? t('stopListening') : t('listen')}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent
                         text-white transition-opacity disabled:opacity-40"
            >
              {speaking || preparingAudio ? <StopIcon /> : <PlayIcon />}
            </button>
            <div className="flex-1">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="label-caps text-white">
                  {preparingAudio
                    ? t('preparingAudio')
                    : speaking
                      ? t('stopListening')
                      : t('overview')}
                </span>
                <span
                  className={[
                    'flex items-center gap-1 rounded border px-2 py-1',
                    usedDeviceVoice
                      ? 'border-sand/40 bg-sand/10 text-sand'
                      : 'border-hairline bg-surface-highest text-muted',
                  ].join(' ')}
                >
                  <VoiceIcon />
                  <span className="label-caps text-[10px]">
                    {usedDeviceVoice ? t('deviceVoice') : voiceLabel(activeVoice, lang)}
                  </span>
                </span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-surface-highest">
                <div
                  className={[
                    'h-full bg-accent transition-all duration-500',
                    speaking ? 'w-full animate-pulse' : 'w-0',
                  ].join(' ')}
                />
              </div>
            </div>
          </div>

          {/* ── The facts. Nothing else on this page makes a claim. ────────── */}
          <div className="mb-10 flex flex-col gap-7">
            {facts.map((fact, i) => (
              <SourcedFact key={i} fact={fact} lang={lang} />
            ))}
          </div>

          {/* The answer to a follow-up.

              RULE 2 applies here as hard as anywhere: the prose is generated,
              so it carries the source badge of every fact it was built from.
              An answer the model could not ground is never shown as an answer
              — the server returns covered: false and we say so plainly. */}
          {(asking || answer) && (
            <div ref={answerRef} className="mb-8 rounded-sheet border border-hairline bg-surface-high/40 p-4">
              {asking && <p className="text-body text-muted">{t('thinking')}</p>}

              {!asking && answer?.kind === 'covered' && (
                <>
                  <p className="mb-3 text-body text-white/90">{answer.text}</p>
                  <p className="mb-2 label-caps text-muted">{t('answerFrom')}</p>
                  <div className="flex flex-wrap gap-2">
                    {answer.fact_indexes.map((i) =>
                      facts[i] ? (
                        <SourceBadge
                          key={i}
                          name={facts[i].source_name}
                          url={facts[i].source_url}
                        />
                      ) : null,
                    )}
                  </div>
                </>
              )}

              {!asking && answer?.kind === 'uncovered' && (
                <p className="text-body text-sand">{t('notInOurSources')}</p>
              )}

              {!asking && answer?.kind === 'failed' && (
                <p className="text-body text-muted">{t('askFailed')}</p>
              )}
            </div>
          )}

          {/* Nearby */}
          {nearby.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 text-headline text-white">{t('nearby')}</h2>
              <div className="scroll-area -mx-gutter flex gap-4 overflow-x-auto px-gutter pb-2">
                {nearby.map((l) => (
                  <Link key={l.id} to={`/story/${l.id}`} className="w-[140px] shrink-0">
                    <img
                      src={l.image}
                      alt=""
                      className="mb-2 aspect-square w-full rounded-ctl object-cover"
                    />
                    <p className="truncate text-body font-semibold text-white">
                      {(lang === 'ar' ? l.name_ar : l.name_en) || l.name_en}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Follow-up. Answered from THIS entry's facts or not at all (T-20). */}
        <form onSubmit={submitQuestion} className="shrink-0 border-t border-hairline bg-surface p-gutter">
          <div className="relative">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={asking}
              maxLength={400}
              placeholder={t('askAboutPlace')}
              className="h-14 w-full rounded-ctl border border-hairline bg-surface-high pe-14 ps-4
                         text-body text-white placeholder:text-muted/60 focus:border-accent
                         focus:outline-none disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={asking || !question.trim()}
              aria-label={t('askAboutPlace')}
              className="absolute end-2 top-2 flex h-10 w-10 items-center justify-center
                         rounded-ctl bg-accent text-white transition-opacity disabled:opacity-40"
            >
              <span aria-hidden="true" className="rtl:rotate-180">↑</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
