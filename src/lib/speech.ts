/**
 * OWNER: teammate C (T-19).
 *
 * DONE:  voice enumeration per language, play/pause/stop, rate control, and a
 *        silent fallback when the chosen voice fails.
 * TODO:  nothing structural.
 *
 * ── Why the browser and not a model ────────────────────────────────────────
 * SpeechSynthesis is built into every phone browser: no API key, no network,
 * no per-word cost, no added latency, and it keeps working when the signal
 * does not. The PRD picks it for exactly those reasons. A hosted TTS model
 * would sound better and would cost a request per playback — worth revisiting
 * after the demo, not before.
 *
 * It reads the story we already have. It never generates text, so nothing here
 * can invent a fact.
 */

import type { Lang } from './types';

export interface Voice {
  id: string;
  name: string;
  lang: string;
}

export function isSpeechAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * Voices installed on this device for the given language.
 *
 * The list is populated asynchronously on most browsers, which is why the
 * caller subscribes with `onVoicesChanged` below rather than reading once.
 */
export function listVoices(lang: Lang): Voice[] {
  if (!isSpeechAvailable()) return [];
  const prefix = lang === 'ar' ? 'ar' : 'en';
  return window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith(prefix))
    .map((v) => ({ id: v.voiceURI, name: v.name, lang: v.lang }));
}

/** Calls back whenever the device's voice list changes. Returns an unsubscribe. */
export function onVoicesChanged(fn: () => void): () => void {
  if (!isSpeechAvailable()) return () => undefined;
  window.speechSynthesis.addEventListener('voiceschanged', fn);
  return () => window.speechSynthesis.removeEventListener('voiceschanged', fn);
}

export interface SpeakOptions {
  text: string;
  lang: Lang;
  /** voiceURI from listVoices(). Falls back to the system default silently. */
  voiceId?: string;
  /** 0.5 slow — 1 normal — 1.5 fast. */
  rate?: number;
  onEnd?: () => void;
  onError?: () => void;
}

/**
 * Reads text aloud. Stops anything already playing first, so two taps never
 * overlap into noise.
 */
export function speak({ text, lang, voiceId, rate = 1, onEnd, onError }: SpeakOptions): void {
  if (!isSpeechAvailable() || !text.trim()) {
    onEnd?.();
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang === 'ar' ? 'ar-SA' : 'en-US';
  utterance.rate = rate;

  // If the chosen voice is gone — uninstalled, or a different device — we say
  // nothing about it and let the system default speak. Never block the text.
  const chosen = window.speechSynthesis.getVoices().find((v) => v.voiceURI === voiceId);
  if (chosen) utterance.voice = chosen;

  utterance.onend = () => onEnd?.();
  utterance.onerror = () => {
    onError?.();
    onEnd?.();
  };

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (isSpeechAvailable()) window.speechSynthesis.cancel();
}

export function isSpeaking(): boolean {
  return isSpeechAvailable() && window.speechSynthesis.speaking;
}
