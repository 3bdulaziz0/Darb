/**
 * OWNER: teammate B, alongside recognize.ts.  Run with:  npm test
 *
 * These pin the client-side safety net. The same rules are enforced on the
 * server in api/recognize.ts — this is the second lock, and it exists because
 * the cost of one confident wrong match is the whole product.
 *
 * Every test here answers the same question: when something is off, do we
 * refuse? The answer must always be yes.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ask, recognize } from './recognize';

const FRAME = 'data:image/jpeg;base64,AAAA';

/** Makes fetch return `body` once, and records what was sent. */
function mockFetch(body: unknown, ok = true, status = 200) {
  const spy = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('recognize', () => {
  it('passes through a confident match that is in the candidate list', async () => {
    mockFetch({ match_id: 'lm_masmak', confidence: 0.93, elements_seen: ['برج'] });
    const result = await recognize({
      frame: FRAME,
      origin: null,
      candidate_ids: ['lm_masmak', 'lm_alula_maraya'],
    });
    expect(result).toEqual({ match_id: 'lm_masmak', confidence: 0.93, elements_seen: ['برج'] });
  });

  it('refuses a match_id that was never a candidate', async () => {
    // The one thing we never trust the model about.
    mockFetch({ match_id: 'lm_somewhere_else', confidence: 0.99, elements_seen: [] });
    const result = await recognize({
      frame: FRAME,
      origin: null,
      candidate_ids: ['lm_masmak'],
    });
    expect(result.match_id).toBeNull();
  });

  it('refuses a match below the confidence threshold', async () => {
    // A weak match is a refusal, not a hedged answer (business rule 4).
    mockFetch({ match_id: 'lm_masmak', confidence: 0.62, elements_seen: ['جدار'] });
    const result = await recognize({
      frame: FRAME,
      origin: null,
      candidate_ids: ['lm_masmak'],
    });
    expect(result.match_id).toBeNull();
    // The observed elements survive — honest mode still has something to show.
    expect(result.elements_seen).toEqual(['جدار']);
  });

  it('refuses without calling the model when there are no candidates', async () => {
    const spy = mockFetch({});
    const result = await recognize({ frame: FRAME, origin: null, candidate_ids: [] });
    expect(result.match_id).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('refuses when there is no frame', async () => {
    const spy = mockFetch({});
    const result = await recognize({ frame: null, origin: null, candidate_ids: ['lm_masmak'] });
    expect(result.match_id).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('refuses when the server sends something malformed', async () => {
    mockFetch({ match_id: 42, confidence: 'high' });
    const result = await recognize({
      frame: FRAME,
      origin: null,
      candidate_ids: ['lm_masmak'],
    });
    expect(result.match_id).toBeNull();
  });

  it('never sends facts or categories to the server, only ids', async () => {
    const spy = mockFetch({ match_id: null, confidence: 0, elements_seen: [] });
    await recognize({ frame: FRAME, origin: null, candidate_ids: ['lm_masmak'] });

    const sent = JSON.parse(spy.mock.calls[0][1].body as string);
    expect(Object.keys(sent).sort()).toEqual(['candidate_ids', 'frame']);
    expect(sent.candidate_ids).toEqual(['lm_masmak']);
  });

  it('throws on a server error rather than inventing an answer', async () => {
    mockFetch({ error: 'boom' }, false, 500);
    await expect(
      recognize({ frame: FRAME, origin: null, candidate_ids: ['lm_masmak'] }),
    ).rejects.toThrow(/boom/);
  });
});

describe('ask', () => {
  it('returns a covered answer with the facts it cited', async () => {
    mockFetch({ covered: true, answer: 'نص الإجابة', fact_indexes: [0, 2] });
    const result = await ask('lm_masmak', 'متى بُني؟', 'ar');
    expect(result).toEqual({ covered: true, answer: 'نص الإجابة', fact_indexes: [0, 2] });
  });

  it('treats an answer that cites nothing as not covered', async () => {
    // Unsourced prose is exactly what this product refuses to show, so an
    // answer with no citation is not an answer.
    mockFetch({ covered: true, answer: 'كلام بلا مصدر', fact_indexes: [] });
    const result = await ask('lm_masmak', 'س', 'ar');
    expect(result.covered).toBe(false);
  });

  it('passes through an explicit not-covered', async () => {
    mockFetch({ covered: false });
    const result = await ask('lm_masmak', 'كم عدد سكان الرياض؟', 'ar');
    expect(result.covered).toBe(false);
  });
});
