/**
 * OWNER: teammate B. T-20.
 *
 * POST /api/ask
 *   { landmark_id: string, question: string, lang: 'ar' | 'en' }
 * → { covered: true, answer: string, fact_indexes: number[] }
 * → { covered: false }
 *
 * ── The one thing this endpoint must never do ──────────────────────────────
 * Answer from the model's own knowledge.
 *
 * Follow-up questions are the likeliest place for fabrication to leak in: the
 * question invites open prose, and the model knows plenty about Saudi heritage
 * that is not in our library. So the prompt carries the entry's facts and
 * nothing else, and the model must return WHICH facts it used. The client
 * renders the source badge for each one it cites.
 *
 * ── Two stages, in this order ──────────────────────────────────────────────
 *   1. The landmark's own facts. If they answer it, that is the answer, and it
 *      cites the fact numbers so the UI can show each source badge.
 *   2. Only if they do not: a Google-grounded search, restricted to the
 *      domains in _trusted.ts, returning the answer with its real citations.
 *
 * Stage 2 is retrieval, not recall. If the search comes back with no citation
 * from a trusted domain, we refuse — because an answer with no source is the
 * model talking from memory, and that is the one thing this product exists to
 * refuse. The UI marks a stage-2 answer as coming from outside the library, so
 * a visitor is never left thinking a web result was curated.
 * ───────────────────────────────────────────────────────────────────────────
 */

import { isTrustedSource } from './_trusted';
import {
  HttpError,
  MODEL,
  type ApiRequest,
  type ApiResponse,
  findLandmark,
  getClient,
  handleErrors,
  originFrom,
  readJsonBody,
} from './_shared';

interface Body {
  landmark_id?: string;
  question?: string;
  lang?: 'ar' | 'en';
}

const MAX_QUESTION = 400;

function buildPrompt(factLines: string, question: string, lang: 'ar' | 'en'): string {
  return `You answer a visitor's question about one heritage landmark, using ONLY the numbered facts below.

=== THE ONLY FACTS YOU MAY USE ===
${factLines}
=== END OF FACTS ===

RULES:
1. Answer ONLY from those facts. You may rephrase, summarise and combine them.
2. You may NOT add anything else — no dates, no names, no events, no context,
   no "it is also known that", nothing you know from elsewhere. If it is not in
   the numbered facts above, it does not exist for this answer.
3. If the facts do not answer the question, set covered to false and leave
   answer empty. Do not apologise, do not partially answer, do not offer a
   related fact instead. Not answering is the correct outcome.
4. fact_indexes lists the numbers of every fact you used. Never cite a fact you
   did not use, and never answer with an empty list.
5. Write the answer in ${lang === 'ar' ? 'Arabic' : 'English'}, in 1 to 3 sentences,
   plainly and without decoration.

VISITOR'S QUESTION: ${question}`;
}

/**
 * Stage 2. Searches, then answers only from what the search returned.
 *
 * The landmark's name and city go into the prompt so the search cannot drift
 * to a different place with a similar name.
 */
function buildSearchPrompt(
  name: string,
  city: string | undefined,
  question: string,
  lang: 'ar' | 'en',
): string {
  return `Answer a visitor's question about a specific heritage landmark in Saudi Arabia.

LANDMARK: ${name}${city ? ` (in ${city})` : ''}
QUESTION: ${question}

RULES:
1. Search for the answer. Use ONLY what the search results actually say.
2. Never answer from memory. If the search does not settle it, say you could
   not find it — that is a correct outcome, not a failure.
3. Prefer official and encyclopaedic sources: UNESCO, Saudi government bodies,
   the Royal Commission for AlUla, Saudipedia, Visit Saudi, Wikipedia.
4. Make sure the results are about THIS landmark and not another place with a
   similar name.
5. Answer in ${lang === 'ar' ? 'Arabic' : 'English'}, in 1 to 3 plain sentences.
   If you could not find it, reply with exactly: NOT_FOUND`;
}

export default handleErrors(async (req: ApiRequest, res: ApiResponse) => {
  const { landmark_id, question, lang = 'ar' } = readJsonBody<Body>(req);

  if (!landmark_id) throw new HttpError(400, 'landmark_id is required.');
  if (!question || !question.trim()) throw new HttpError(400, 'question is required.');
  if (question.length > MAX_QUESTION) {
    throw new HttpError(400, `Question is too long (max ${MAX_QUESTION} characters).`);
  }

  const landmark = await findLandmark(originFrom(req), landmark_id);
  if (!landmark) throw new HttpError(404, 'That landmark is not in the library.');

  // Only facts that carry a source can be quoted — same rule as the UI.
  const usable = landmark.facts.filter((f) => f.source_url && f.source_name);
  if (usable.length === 0) {
    res.status(200).json({ covered: false });
    return;
  }

  const factLines = usable
    .map((f, i) => {
      const text = (lang === 'ar' ? f.text_ar : f.text_en) || f.text_en || f.text_ar;
      return `[${i}] ${text}`;
    })
    .join('\n');

  const ai = getClient();
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: buildPrompt(factLines, question.trim(), lang) }] }],
    config: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          covered: { type: 'boolean' },
          answer: { type: 'string' },
          fact_indexes: { type: 'array', items: { type: 'integer' } },
        },
        required: ['covered', 'answer', 'fact_indexes'],
      },
    },
  });

  const raw = response.text;
  if (!raw) throw new HttpError(502, 'The model returned an empty response.');

  let parsed: { covered?: unknown; answer?: unknown; fact_indexes?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new HttpError(502, 'The model returned something that is not JSON.');
  }

  const answer = typeof parsed.answer === 'string' ? parsed.answer.trim() : '';

  // Keep only indexes that actually exist. A citation we cannot resolve is
  // worse than no answer, because it would render a badge pointing nowhere.
  const fact_indexes = Array.isArray(parsed.fact_indexes)
    ? [...new Set(parsed.fact_indexes)]
        .filter((n): n is number => Number.isInteger(n) && n >= 0 && n < usable.length)
        .sort((a, b) => a - b)
    : [];

  // An answer with no resolvable citation is unsourced prose, which is exactly
  // what this product refuses to show. Fall through to the search instead.
  if (parsed.covered === true && answer && fact_indexes.length > 0) {
    res.status(200).json({ source: 'library', answer, fact_indexes, model: MODEL });
    return;
  }

  // ── Stage 2: the library does not cover it, so look it up ────────────────
  try {
    res.status(200).json(await searchTrustedSources(landmark, question.trim(), lang));
  } catch (err) {
    // Search being unavailable is NOT the same as the answer not existing, and
    // the visitor must not be told the second when the first is true. Grounded
    // search has its own quota, separate from ordinary generation.
    const message = err instanceof Error ? err.message : String(err);
    const quota = /RESOURCE_EXHAUSTED|429|quota/i.test(message);
    console.error('[api/ask] search unavailable:', message.slice(0, 200));
    res.status(200).json({ source: 'unavailable', reason: quota ? 'quota' : 'error' });
  }
});

/**
 * Runs a grounded search and keeps the answer only if it is actually
 * supported by a trusted citation.
 */
async function searchTrustedSources(
  landmark: NonNullable<Awaited<ReturnType<typeof findLandmark>>>,
  question: string,
  lang: 'ar' | 'en',
): Promise<Record<string, unknown>> {
  const ai = getClient();

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { text: buildSearchPrompt(landmark.name_en, landmark.city, question, lang) },
        ],
      },
    ],
    config: {
      temperature: 0,
      // Retrieval, not recall. Without this tool the model would answer from
      // memory and we would have no citations to check it against.
      tools: [{ googleSearch: {} }],
    },
  });

  const answer = response.text?.trim() ?? '';
  const grounding = response.candidates?.[0]?.groundingMetadata;

  // Every distinct source the search actually surfaced.
  const seen = new Set<string>();
  const citations = (grounding?.groundingChunks ?? [])
    .map((chunk) => ({ title: chunk.web?.title ?? '', uri: chunk.web?.uri ?? '' }))
    .filter((c) => c.uri && isTrustedSource(c.title, c.uri))
    .filter((c) => {
      if (seen.has(c.uri)) return false;
      seen.add(c.uri);
      return true;
    })
    .slice(0, 4);

  // Three ways this can still be a refusal, and all of them are the same
  // failure: we cannot show where the answer came from.
  if (!answer || answer.includes('NOT_FOUND')) return { source: 'none' };
  if (citations.length === 0) return { source: 'none', reason: 'no_trusted_source' };

  return {
    source: 'web',
    answer,
    citations,
    queries: grounding?.webSearchQueries ?? [],
    model: MODEL,
  };
}
