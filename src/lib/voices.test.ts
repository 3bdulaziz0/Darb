/**
 * OWNER: teammate C, alongside voices.ts.  Run with:  npm test
 */

import { describe, expect, it } from 'vitest';
import { VOICES, defaultVoiceId, findVoice, voicesFor } from './voices';

describe('the narration voices', () => {
  it('offers exactly two per language', () => {
    expect(voicesFor('ar')).toHaveLength(2);
    expect(voicesFor('en')).toHaveLength(2);
    expect(VOICES).toHaveLength(4);
  });

  it('maps each one to a distinct Gemini voice', () => {
    const names = VOICES.map((v) => v.gemini);
    expect(new Set(names).size).toBe(names.length);
  });

  it('gives every voice a label and a character in both languages', () => {
    for (const v of VOICES) {
      expect(v.label_ar.trim()).not.toBe('');
      expect(v.label_en.trim()).not.toBe('');
      expect(v.character_ar.trim()).not.toBe('');
      expect(v.character_en.trim()).not.toBe('');
    }
  });

  it('has a default per language, and it belongs to that language', () => {
    expect(findVoice(defaultVoiceId('ar'))?.lang).toBe('ar');
    expect(findVoice(defaultVoiceId('en'))?.lang).toBe('en');
  });

  it('does not resolve a voice id we never offered', () => {
    // The server validates against this list, so an unknown id must not pass.
    expect(findVoice('Zephyr')).toBeUndefined();
    expect(findVoice('')).toBeUndefined();
  });
});
