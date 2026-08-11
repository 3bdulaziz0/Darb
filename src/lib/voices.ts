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

export const VOICES: VoiceOption[] = [
  {
    id: 'ar-kore',
    gemini: 'Kore',
    lang: 'ar',
    label_ar: 'كوري',
    label_en: 'Kore',
    character_ar: 'واضح',
    character_en: 'Firm',
  },
  {
    id: 'ar-achernar',
    gemini: 'Achernar',
    lang: 'ar',
    label_ar: 'أخرنار',
    label_en: 'Achernar',
    character_ar: 'هادئ',
    character_en: 'Soft',
  },
  {
    id: 'en-charon',
    gemini: 'Charon',
    lang: 'en',
    label_ar: 'كارون',
    label_en: 'Charon',
    character_ar: 'إخباري',
    character_en: 'Informative',
  },
  {
    id: 'en-aoede',
    gemini: 'Aoede',
    lang: 'en',
    label_ar: 'أويدي',
    label_en: 'Aoede',
    character_ar: 'خفيف',
    character_en: 'Breezy',
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
