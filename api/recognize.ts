/**
 * OWNER: teammate B. T-12, T-13, T-14.
 *
 * POST /api/recognize
 *   { frame: "data:image/jpeg;base64,…", candidate_ids: string[] }
 * → { match_id: string | null, confidence: number, elements_seen: string[] }
 *
 * ── The four guarantees, in order ──────────────────────────────────────────
 *   1. The model only ever sees candidates the client asked for AND that we
 *      can actually identify — ids are resolved against the library on this
 *      side, so a client cannot invent one.
 *   2. It receives names, visual markers and reference photographs. It never
 *      receives facts, categories or cities: those would let it match on what
 *      a place *is* rather than what the photograph *shows*.
 *   3. Any match_id outside the submitted list is rejected here, after the
 *      model has answered. The enum in the schema is a hint; this is the
 *      guarantee.
 *   4. Confidence below the threshold becomes match_id: null. A weak match is
 *      a refusal, never a hedged answer.
 * ───────────────────────────────────────────────────────────────────────────
 */

import type { Part } from '@google/genai';
import {
  CONFIDENCE_THRESHOLD,
  HttpError,
  MODEL,
  type ApiRequest,
  type ApiResponse,
  findLandmark,
  getClient,
  handleErrors,
  parseDataUrl,
  readJsonBody,
  readReferenceImages,
} from './_shared';

interface Body {
  frame?: string;
  candidate_ids?: string[];
}

const SYSTEM = `You identify heritage landmarks in Saudi Arabia from a single photograph.

You are given a photograph taken by a visitor, and a numbered list of candidate
landmarks. Each candidate has a name, may have written visual markers, and may
have reference photographs of it.

Your only job is to decide which candidate, if any, is the building or place in
the visitor's photograph.

RULES, in order of importance:

1. If the photograph does not clearly show one of the candidates, return
   match_id: null. This is the correct and expected answer whenever you are not
   sure. A wrong confident answer is far worse than saying you do not know.
2. Match on what is visible: shape, structure, materials, distinctive features,
   the arrangement of parts. Compare against the reference photographs and the
   written markers.
3. Never match on the name alone, on plausibility, or on what is common in the
   region. If a candidate has no reference photographs and no markers, you have
   nothing to compare and must not select it.
4. A photograph of a different building that merely resembles a candidate is
   NOT a match. Interiors, close-ups of unrelated detail, people, food, signs,
   screenshots and documents are never a match.
5. confidence is your genuine probability that the match is correct, from 0 to
   1. Do not inflate it. If you would not stake the product's credibility on
   it, it is below 0.8.
6. elements_seen lists 2 to 4 architectural or natural features you can
   actually see in the visitor's photograph, in Arabic, as short noun phrases
   (for example: "قبة", "برج حجري", "نقوش صخرية"). Describe only what is
   visible. Never name the building there, never state its history, and never
   guess a date. Fill this in whether or not you found a match.`;

export default handleErrors(async (req: ApiRequest, res: ApiResponse) => {
  const { frame, candidate_ids } = readJsonBody<Body>(req);

  if (!frame) throw new HttpError(400, 'frame is required.');
  if (!Array.isArray(candidate_ids)) throw new HttpError(400, 'candidate_ids is required.');

  // Resolve ids against our own copy of the library. An id the client made up
  // simply does not resolve, and an entry with nothing to compare against is
  // dropped — see guarantee 1 and rule 3 above.
  const candidates = candidate_ids
    .map((id) => findLandmark(id))
    .filter((l): l is NonNullable<typeof l> => Boolean(l))
    .filter((l) => l.visual_markers.length > 0 || (l.reference_images?.length ?? 0) > 0);

  // Nothing we can identify nearby is a refusal, not a wider search.
  if (candidates.length === 0) {
    res.status(200).json({ match_id: null, confidence: 0, elements_seen: [] });
    return;
  }

  const parts: Part[] = [{ text: SYSTEM }, { text: '\n=== CANDIDATES ===' }];

  candidates.forEach((landmark, i) => {
    parts.push({
      text:
        `\nCandidate ${i + 1} of ${candidates.length}\n` +
        `id: ${landmark.id}\n` +
        `name: ${landmark.name_en}\n` +
        (landmark.visual_markers.length
          ? `visual markers:\n${landmark.visual_markers.map((m) => `  - ${m}`).join('\n')}\n`
          : 'visual markers: none written yet\n'),
    });

    const refs = readReferenceImages(landmark);
    if (refs.length) {
      parts.push({ text: `reference photographs of ${landmark.name_en}:` });
      parts.push(...refs);
    }
  });

  parts.push({ text: "\n=== THE VISITOR'S PHOTOGRAPH ===" });
  parts.push({ inlineData: parseDataUrl(frame) });
  parts.push({
    text:
      '\nWhich candidate is in the visitor\'s photograph? Answer null unless you ' +
      'are confident. Reply with JSON only.',
  });

  const ai = getClient();
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts }],
    config: {
      // Determinism: the same photograph must yield the same match across runs
      // or the accuracy numbers we report mean nothing.
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          match_id: {
            type: 'string',
            nullable: true,
            enum: candidates.map((c) => c.id),
            description: 'The candidate id, or null if none of them is in the photograph.',
          },
          confidence: { type: 'number' },
          elements_seen: { type: 'array', items: { type: 'string' } },
        },
        required: ['match_id', 'confidence', 'elements_seen'],
      },
    },
  });

  const raw = response.text;
  if (!raw) throw new HttpError(502, 'The model returned an empty response.');

  let parsed: { match_id?: unknown; confidence?: unknown; elements_seen?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new HttpError(502, 'The model returned something that is not JSON.');
  }

  const elements_seen = Array.isArray(parsed.elements_seen)
    ? parsed.elements_seen.filter((e): e is string => typeof e === 'string').slice(0, 4)
    : [];

  const confidence =
    typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)
      ? Math.min(1, Math.max(0, parsed.confidence))
      : 0;

  // ── Guarantee 3: never trust the model to stay inside the list ────────────
  const allowed = new Set(candidates.map((c) => c.id));
  const claimed = typeof parsed.match_id === 'string' ? parsed.match_id : null;
  if (claimed && !allowed.has(claimed)) {
    console.error('[api] model returned an out-of-list id, refusing:', claimed);
    res.status(200).json({ match_id: null, confidence: 0, elements_seen });
    return;
  }

  // ── Guarantee 4: sub-threshold is a refusal ──────────────────────────────
  const match_id = claimed && confidence >= CONFIDENCE_THRESHOLD ? claimed : null;

  res.status(200).json({ match_id, confidence, elements_seen });
});
