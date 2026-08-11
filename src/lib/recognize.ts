/**
 * OWNER: teammate B (recognition core).
 *
 * DONE:  real recognition. Resolves candidate ids to their visual markers via
 *        the library, posts the frame + candidates to the serverless gateway
 *        (/api/recognize), validates the response, and enforces the contract:
 *        an out-of-list id or sub-threshold confidence becomes a refusal.
 * TODO:  none. Tune CONFIDENCE_THRESHOLD on the day-4 test photos.
 *
 * Callers must not care whether this is the stub or the real thing — the
 * contract is the same either way: a MatchResult, or a thrown error.
 *
 * Never calls Gemini from the browser (CLAUDE.md rule 4). The key lives on the
 * server; this file only ever talks to /api/recognize.
 */

import type { Coordinates, MatchResult } from './types';
import { loadLandmarks } from './library';
import { isForcedNoMatch } from './mockData';

export interface RecognizeInput {
  /** Captured frame as a data URL. Null while the camera is still a stub. */
  frame: string | null;
  /** Where the user is. Null when location was denied (manual fallback). */
  origin: Coordinates | null;
  /** Ids recognition is allowed to choose from. Nothing else may be returned. */
  candidate_ids: string[];
}

/** Below this, a match is not a match — it is a refusal (business rule 4). */
export const CONFIDENCE_THRESHOLD = 0.8;

/** A refusal: we do not recognise it. Routed to /unknown, no name/date/story. */
const NO_MATCH: MatchResult = { match_id: null, confidence: 0, elements_seen: [] };

/** Thrown on network/gateway failure. CameraPage shows the error state. */
export class RecognizeError extends Error {}

/**
 * Resolve a captured frame to a landmark, or to an explicit non-match.
 *
 * @returns MatchResult — `match_id: null` means we do not recognise it.
 *          Callers route that to /unknown and show no name, date or story.
 */
export async function recognize(input: RecognizeInput): Promise<MatchResult> {
  const { frame, candidate_ids } = input;

  // DEV: the chip on the camera screen forces a refusal so honest mode can be
  // demoed on demand. Temporary — goes out with mockData.ts before the demo.
  if (isForcedNoMatch()) return NO_MATCH;

  // A missing frame is a bug upstream, not a refusal — fail loudly.
  if (!frame) throw new RecognizeError('no_frame');

  // No nearby candidates is a legitimate refusal. Never widen the search
  // silently (business rule): show honest mode instead.
  if (!candidate_ids || candidate_ids.length === 0) return NO_MATCH;

  // Turn ids into the payload the model may see: id + visual_markers ONLY.
  // No name, no category, no tags — sending those makes the model guess from
  // fame instead of matching what it can see (CLAUDE.md).
  const landmarks = await loadLandmarks();
  const byId = new Map(landmarks.map((l) => [l.id, l]));
  const candidates = candidate_ids
    .map((id) => byId.get(id))
    .filter((l): l is NonNullable<typeof l> => Boolean(l))
    .map((l) => ({ id: l.id, visual_markers: l.visual_markers }));

  if (candidates.length === 0) return NO_MATCH;

  // ── call the gateway ──────────────────────────────────────────────────────
  let data: unknown;
  try {
    const res = await fetch('/api/recognize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: frame,
        mimeType: mimeFromDataUrl(frame),
        candidates,
      }),
    });
    if (!res.ok) throw new Error(`recognize_${res.status}`);
    data = await res.json();
  } catch (err) {
    throw new RecognizeError(err instanceof Error ? err.message : 'recognition_failed');
  }

  // ── re-enforce the contract on the client (never trust the wire) ──────────
  const d = (data ?? {}) as Record<string, unknown>;
  let match_id = typeof d.match_id === 'string' ? d.match_id : null;
  let confidence = Number(d.confidence);
  if (!Number.isFinite(confidence)) confidence = 0;
  confidence = Math.max(0, Math.min(1, confidence));
  const elements_seen = Array.isArray(d.elements_seen)
    ? (d.elements_seen.filter((e) => typeof e === 'string') as string[]).slice(0, 4)
    : [];

  const allowed = new Set(candidate_ids);
  if (match_id !== null && !allowed.has(match_id)) match_id = null; // out-of-list -> refuse
  if (match_id !== null && confidence < CONFIDENCE_THRESHOLD) match_id = null; // low -> refuse

  return { match_id, confidence, elements_seen };
}

/** Reads the mime type out of a data URL, e.g. "data:image/png;base64,…". */
function mimeFromDataUrl(dataUrl: string): string {
  const m = /^data:([^;]+);/.exec(dataUrl);
  return m ? m[1] : 'image/jpeg';
} 
