/**
 * OWNER: teammate B (recognition core).
 *
 * DONE:  calls /api/recognize, validates the response, and falls back to a
 *        refusal rather than an error whenever the answer is unusable.
 * TODO:  1. Preserve the frame and offer a single retry on timeout (Epic 5).
 *        2. "Not this one?" — the next-best candidate (T-13).
 *
 * The guarantees live on the server, in api/recognize.ts: the key stays there,
 * the grounding prompt cannot be edited from here, out-of-list ids are
 * rejected, and sub-threshold confidence becomes a refusal. This file is the
 * transport, and it is deliberately thin.
 *
 * Set VITE_RAWI_USE_STUB=1 to work offline without burning API calls.
 */

import type { Coordinates, MatchResult } from './types';
import { MOCK_RESULT, MOCK_NO_MATCH, isForcedNoMatch } from './mockData';

export interface RecognizeInput {
  /** Captured frame as a data URL. */
  frame: string | null;
  /** Where the user is. Null when location was denied. */
  origin: Coordinates | null;
  /** Ids recognition is allowed to choose from. Nothing else may be returned. */
  candidate_ids: string[];
}

/** Mirrors the server default. The server's value is the one that decides. */
export const CONFIDENCE_THRESHOLD = 0.8;

/** How long we wait before giving up on the model. */
const TIMEOUT_MS = 30_000;

/** A refusal, used whenever we cannot get a trustworthy answer. */
const REFUSAL: MatchResult = { match_id: null, confidence: 0, elements_seen: [] };

const useStub = import.meta.env.VITE_RAWI_USE_STUB === '1';

/**
 * Resolve a captured frame to a landmark, or to an explicit non-match.
 *
 * @returns MatchResult — `match_id: null` means we do not recognise it.
 *          Callers route that to /not-found and show no name, date or story.
 */
export async function recognize(input: RecognizeInput): Promise<MatchResult> {
  // The dev chip on the camera screen, and the offline stub, both short-circuit
  // here. Both go out with mockData.ts before the demo build.
  if (isForcedNoMatch()) {
    await new Promise((r) => setTimeout(r, 600));
    return MOCK_NO_MATCH;
  }
  if (useStub) {
    await new Promise((r) => setTimeout(r, 600));
    return MOCK_RESULT;
  }

  if (!input.frame) return REFUSAL;
  // Nothing we can identify nearby is a refusal, not a wider search.
  if (input.candidate_ids.length === 0) return REFUSAL;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch('/api/recognize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // The server resolves ids against its own copy of the library, so this
      // is all it needs — and all it should be trusted with.
      body: JSON.stringify({ frame: input.frame, candidate_ids: input.candidate_ids }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.error ?? `Recognition failed (${response.status}).`);
    }

    const data: unknown = await response.json();
    return validate(data, input.candidate_ids);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Checks the server's answer before anything acts on it.
 *
 * The server already enforces this, so a failure here means something is badly
 * wrong — and the safe response to "something is wrong" is a refusal, never a
 * guess. Belt and braces, because the cost of a confident wrong match is the
 * whole product.
 */
function validate(data: unknown, allowed: string[]): MatchResult {
  if (typeof data !== 'object' || data === null) return REFUSAL;

  const { match_id, confidence, elements_seen } = data as Record<string, unknown>;

  const elements = Array.isArray(elements_seen)
    ? elements_seen.filter((e): e is string => typeof e === 'string')
    : [];

  const score =
    typeof confidence === 'number' && Number.isFinite(confidence)
      ? Math.min(1, Math.max(0, confidence))
      : 0;

  if (typeof match_id !== 'string') {
    return { match_id: null, confidence: score, elements_seen: elements };
  }

  if (!allowed.includes(match_id) || score < CONFIDENCE_THRESHOLD) {
    return { match_id: null, confidence: score, elements_seen: elements };
  }

  return { match_id, confidence: score, elements_seen: elements };
}

// ── Follow-up questions ─────────────────────────────────────────────────────

export type AskResult =
  | { covered: true; answer: string; fact_indexes: number[] }
  | { covered: false };

/**
 * Ask a question about one landmark. Answered strictly from that entry's
 * facts, or not at all.
 *
 * `fact_indexes` are positions in the landmark's sourced facts, so the caller
 * can render the badge for each one the answer used. An answer that cites
 * nothing is returned as `covered: false` by the server — unsourced prose is
 * not something this product shows.
 */
export async function ask(
  landmark_id: string,
  question: string,
  lang: 'ar' | 'en',
): Promise<AskResult> {
  const response = await fetch('/api/ask', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ landmark_id, question, lang }),
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.error ?? `Question failed (${response.status}).`);
  }

  const data = (await response.json()) as Record<string, unknown>;

  if (
    data.covered === true &&
    typeof data.answer === 'string' &&
    Array.isArray(data.fact_indexes) &&
    data.fact_indexes.length > 0
  ) {
    return {
      covered: true,
      answer: data.answer,
      fact_indexes: data.fact_indexes.filter((n): n is number => Number.isInteger(n)),
    };
  }

  return { covered: false };
}
