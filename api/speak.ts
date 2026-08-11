/**
 * OWNER: teammate C (T-19), served by teammate B's api layer.
 *
 * POST /api/speak
 *   { text: string, voice_id: string, lang: 'ar' | 'en' }
 * → { audio: "data:audio/wav;base64,…", voice: string }
 *
 * ── What this endpoint may and may not say ─────────────────────────────────
 * It reads text back. It never writes any.
 *
 * The caller sends the sourced fact text already on screen, and the model is
 * given no room to add to it — TTS returns audio for the words it was handed.
 * If a future change has this endpoint summarise, rephrase, or "make it flow",
 * that is generated narration with no source attached, and it breaks rule 1.
 * ───────────────────────────────────────────────────────────────────────────
 */

import {
  HttpError,
  type ApiRequest,
  type ApiResponse,
  getClient,
  handleErrors,
  readJsonBody,
} from './_shared.js';
import { findVoice } from '../src/lib/voices.js';

interface Body {
  text?: string;
  voice_id?: string;
  lang?: 'ar' | 'en';
}

/**
 * Default speech model. Override with GEMINI_TTS_MODEL.
 *
 * Speech needs a model built for it. A general text model accepts the request,
 * answers, and simply returns no audio part — so this must never be set to
 * whatever GEMINI_MODEL is.
 */
const TTS_MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-3.1-flash-tts-preview';

/**
 * Roughly 90 seconds of speech.
 *
 * The audio comes back as uncompressed 24 kHz PCM — about 48 KB per second,
 * and base64 adds a third on top. Left uncapped, a long entry would push
 * several megabytes down a phone connection to say one paragraph.
 */
const MAX_CHARS = 1400;

/** Gemini returns raw PCM: 24 kHz, mono, 16-bit signed little-endian. */
const SAMPLE_RATE = 24_000;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;

/**
 * Wraps raw PCM in a WAV container.
 *
 * Browsers will not play headerless PCM. A WAV header is 44 bytes describing
 * the rate, channel count and bit depth, after which the samples follow
 * unchanged — so this adds no re-encoding and no quality loss.
 */
function pcmToWav(pcm: Buffer): Buffer {
  const byteRate = (SAMPLE_RATE * CHANNELS * BITS_PER_SAMPLE) / 8;
  const blockAlign = (CHANNELS * BITS_PER_SAMPLE) / 8;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4); // file size minus the first 8 bytes
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // 1 = uncompressed PCM
  header.writeUInt16LE(CHANNELS, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(BITS_PER_SAMPLE, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}

export default handleErrors(async (req: ApiRequest, res: ApiResponse) => {
  const { text, voice_id, lang = 'ar' } = readJsonBody<Body>(req);

  if (!text || !text.trim()) throw new HttpError(400, 'text is required.');

  // Only our four curated voices. An arbitrary voice name from the client
  // would be an open door to whatever else the model exposes.
  const voice = voice_id ? findVoice(voice_id) : undefined;
  if (!voice) throw new HttpError(400, 'voice_id must be one of the offered voices.');

  const spoken = text.trim().slice(0, MAX_CHARS);

  const ai = getClient();
  const response = await ai.models.generateContent({
    model: TTS_MODEL,
    // Handed over as-is. No instruction to rewrite, shorten or embellish.
    contents: [{ role: 'user', parts: [{ text: spoken }] }],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        languageCode: lang === 'ar' ? 'ar-EG' : 'en-US',
        voiceConfig: { prebuiltVoiceConfig: { voiceName: voice.gemini } },
      },
    },
  });

  const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!data) {
    throw new HttpError(
      502,
      `${TTS_MODEL} returned no audio. That usually means it is a text model ` +
        'rather than a speech one — set GEMINI_TTS_MODEL to a *-tts model, or ' +
        'leave it unset to use the default.',
    );
  }

  const wav = pcmToWav(Buffer.from(data, 'base64'));

  res.status(200).json({
    audio: `data:audio/wav;base64,${wav.toString('base64')}`,
    voice: voice.gemini,
    truncated: text.trim().length > MAX_CHARS,
  });
});
