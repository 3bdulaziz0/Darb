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
 * A question the facts do not cover returns covered: false, and the UI says so
 * plainly. That is a feature, not a gap.
 * ───────────────────────────────────────────────────────────────────────────
 */

import {
  HttpError,
  MODEL,
  type ApiRequest,
  type ApiResponse,
  findLandmark,
  getClient,
  handleErrors,
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

export default handleErrors(async (req: ApiRequest, res: ApiResponse) => {
  const { landmark_id, question, lang = 'ar' } = readJsonBody<Body>(req);

  if (!landmark_id) throw new HttpError(400, 'landmark_id is required.');
  if (!question || !question.trim()) throw new HttpError(400, 'question is required.');
  if (question.length > MAX_QUESTION) {
    throw new HttpError(400, `Question is too long (max ${MAX_QUESTION} characters).`);
  }

  const landmark = findLandmark(landmark_id);
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
  // what this product refuses to show. Treat it as not covered.
  if (parsed.covered !== true || !answer || fact_indexes.length === 0) {
    res.status(200).json({ covered: false });
    return;
  }

  res.status(200).json({ covered: true, answer, fact_indexes, model: MODEL });
});
