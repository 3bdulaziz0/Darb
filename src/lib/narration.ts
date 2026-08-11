/**
 * OWNER: teammate C (T-19).
 *
 * The narration voice and speed, shared between the settings sheet where they
 * are chosen and the story page where they are used.
 *
 * Session-scoped: a voice is a mood, not a lasting preference, and the PRD
 * only asks it to persist for the session. Favourites are the one thing that
 * outlives a visit — see lib/favourites.ts.
 */

import { defaultVoiceId, findVoice } from './voices';
import type { Lang } from './types';

const VOICE_KEY = 'rawi:voice';
const RATE_KEY = 'rawi:rate';

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

/** The chosen voice for a language, or that language's default. */
export function getVoiceId(lang: Lang): string {
  try {
    const stored = sessionStorage.getItem(`${VOICE_KEY}:${lang}`);
    // A stored id from an older build may no longer exist.
    if (stored && findVoice(stored)?.lang === lang) return stored;
  } catch {
    // Private browsing. Fall through to the default.
  }
  return defaultVoiceId(lang);
}

export function setVoiceId(lang: Lang, id: string): void {
  try {
    sessionStorage.setItem(`${VOICE_KEY}:${lang}`, id);
  } catch {
    // Non-fatal — the choice just will not survive a reload.
  }
  notify();
}

export function getRate(): number {
  try {
    const stored = Number(sessionStorage.getItem(RATE_KEY));
    if (Number.isFinite(stored) && stored >= 0.5 && stored <= 1.5) return stored;
  } catch {
    // Fall through.
  }
  return 1;
}

export function setRate(rate: number): void {
  try {
    sessionStorage.setItem(RATE_KEY, String(rate));
  } catch {
    // Non-fatal.
  }
  notify();
}

export function onNarrationChanged(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
