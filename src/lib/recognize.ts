/**
 * OWNER: teammate B (recognition core).
 *
 * DONE:  the signature, and a stub that resolves a mock MatchResult after 1s.
 * TODO:  everything below the line. See the TODO block.
 *
 * Callers must not care whether this is the stub or the real thing — the
 * contract is the same either way: a MatchResult, or a thrown error.
 */

import type { Coordinates, MatchResult } from './types';
import { MOCK_NO_MATCH, MOCK_RESULT, isForcedNoMatch } from './mockData';

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

/**
 * Resolve a captured frame to a landmark, or to an explicit non-match.
 *
 * @returns MatchResult — `match_id: null` means we do not recognise it.
 *          Callers route that to /unknown and show no name, date or story.
 */
export async function recognize(_input: RecognizeInput): Promise<MatchResult> {
  // ─────────────────────────────────────────────────────────────────────────
  // TODO(teammate B) — replace this stub. T-12, T-13, T-14.
  //
  //   1. POST { frame, candidate_ids } to /api/recognize (serverless).
  //      Never call Gemini from the browser — the key stays server-side.
  //   2. Validate the response against the strict MatchResult schema.
  //   3. REJECT any match_id that is not in `candidate_ids`. Do not trust the
  //      model to stay inside the candidate set — verify it.
  //   4. If confidence < CONFIDENCE_THRESHOLD, return match_id: null.
  //      A low-confidence match is a refusal, never a hedged answer.
  //   5. On an empty candidate set, return match_id: null with
  //      elements_seen: [] — do not widen the search silently.
  //
  // Everything upstream of this function already works: CameraPage drives the
  // three status stages off the promise, and routes a null match to /unknown.
  // ─────────────────────────────────────────────────────────────────────────

  await new Promise((resolve) => setTimeout(resolve, 1000));

  // TEMPORARY: the DEV chip on the camera screen forces a refusal so the
  // honest-mode path can be demoed on demand. Goes out with mockData.ts.
  return isForcedNoMatch() ? MOCK_NO_MATCH : MOCK_RESULT;
}
