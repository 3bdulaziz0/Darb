/**
 * OWNER: shared — the client renders this list, the server validates against
 * it. Keep it small.
 *
 * DONE:  four narration voices, two per language.
 * TODO:  nothing. Adding a fifth is a one-line change here, but think first:
 *        every extra voice is another thing to audition before a demo.
 *
 * ── Why only four ──────────────────────────────────────────────────────────
 * Gemini publishes about thirty prebuilt voices. Almost all of them are wrong
 * for a heritage guide, and a long list makes a visitor audition rather than
 * listen. Two per language is enough to offer a real choice — one warmer, one
 * firmer — without turning settings into a menu.
 *
 * The voices themselves are multilingual; the language comes from the text and
 * from `languageCode`. Pairing each voice with a language here is a curation
 * decision about which ones read Arabic and English well, not a technical
 * limit.
 */

import type { Lang } from './types';

export interface VoiceOption {
  /** Our id, and what the client sends to /api/speak. */
  id: string;
  /** The prebuilt Gemini voice this maps to. */
  gemini: string;
  lang: Lang;
  /** Shown in settings. */
  label_ar: string;
  label_en: string;
  /** One word on how it reads. */
  character_ar: string;
  character_en: string;
}

/**
 * The names a visitor sees are people's names, not the model's.
 *
 * "Kore" and "Achernar" are Google's internal labels for its prebuilt voices —
 * star names, meaningless to anyone choosing a narrator. A visitor picking who
 * will tell them a story is choosing a person, so the list reads as people.
 * The design mock had Layla, Omar and Sarah; this keeps them.
 *
 * `gemini` is the real voice id and the only part the API sees. Renaming
 * anyone here is a label change, never a change of voice.
 *
 * The Arabic character words agree in gender with the name they sit beside —
 * هادئة for ليلى, واضح for عمر — which is why they are written per voice
 * rather than shared across the pair.
 */
export const VOICES: VoiceOption[] = [
  {
    id: 'ar-layla',
    gemini: 'Kore',
    lang: 'ar',
    label_ar: 'ليلى',
    label_en: 'Layla',
    character_ar: 'هادئة',
    character_en: 'Calm',
  },
  {
    id: 'ar-omar',
    gemini: 'Orus',
    lang: 'ar',
    label_ar: 'عمر',
    label_en: 'Omar',
    character_ar: 'واضح',
    character_en: 'Clear',
  },
  {
    id: 'en-sarah',
    gemini: 'Aoede',
    lang: 'en',
    label_ar: 'سارة',
    label_en: 'Sarah',
    character_ar: 'دافئة',
    character_en: 'Warm',
  },
  {
    id: 'en-adam',
    gemini: 'Charon',
    lang: 'en',
    label_ar: 'آدم',
    label_en: 'Adam',
    character_ar: 'رصين',
    character_en: 'Measured',
  },
];

/** The voices offered for a language. Always two. */
export function voicesFor(lang: Lang): VoiceOption[] {
  return VOICES.filter((v) => v.lang === lang);
}

export function findVoice(id: string): VoiceOption | undefined {
  return VOICES.find((v) => v.id === id);
}

/** The voice used when the visitor has not chosen one. */
export function defaultVoiceId(lang: Lang): string {
  return voicesFor(lang)[0].id;
}

export function voiceLabel(voice: VoiceOption, lang: Lang): string {
  return lang === 'ar' ? voice.label_ar : voice.label_en;
}

export function voiceCharacter(voice: VoiceOption, lang: Lang): string {
  return lang === 'ar' ? voice.character_ar : voice.character_en;
}
