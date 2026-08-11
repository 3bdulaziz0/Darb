/**
 * OWNER: teammate B (recognition core).
 *
 * Shared server-side helpers for the functions in api/.
 *
 * ── Why this code is on a server at all ────────────────────────────────────
 * Two reasons, and both are load bearing:
 *
 *   1. The API key stays here. Anything in src/ is shipped to the browser and
 *      is readable by anyone. See .env.example.
 *   2. The grounding prompt and the response schema stay here, so they cannot
 *      be edited from the client. If a visitor could rewrite the prompt, every
 *      guarantee this product makes about refusal would be theirs to remove.
 * ───────────────────────────────────────────────────────────────────────────
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GoogleGenAI } from '@google/genai';
import type { Landmark } from '../src/lib/types';

/** Below this, a match is not a match — it is a refusal (business rule 4). */
export const CONFIDENCE_THRESHOLD = Number(process.env.DARB_CONFIDENCE_THRESHOLD) || 0.8;

/** Conservative default. Override with GEMINI_MODEL once you know your access. */
export const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

/** At most this many reference photographs per candidate go into a prompt. */
export const REFS_PER_CANDIDATE = 2;

export function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new HttpError(
      500,
      'GEMINI_API_KEY is not set. Copy .env.example to .env and fill it in, ' +
        'and set the same variable in your hosting project settings.',
    );
  }
  return new GoogleGenAI({ apiKey });
}

/** An error with a status code, so handlers can fail with the right one. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

// ── The library, server side ────────────────────────────────────────────────

let cached: Landmark[] | null = null;

/**
 * Loads the curated library from disk.
 *
 * The client sends candidate ids, never landmark content. Everything the model
 * is allowed to see is read here, from the file we control — so a client
 * cannot inject a fake landmark, fake markers, or a fake fact.
 */
export function loadLibrary(): Landmark[] {
  if (!cached) {
    const file = join(process.cwd(), 'public', 'landmarks.json');
    cached = JSON.parse(readFileSync(file, 'utf8')) as Landmark[];
  }
  return cached;
}

export function findLandmark(id: string): Landmark | undefined {
  return loadLibrary().find((l) => l.id === id);
}

/**
 * Reads a landmark's reference photographs off disk as base64.
 *
 * Capped per candidate: a prompt carrying eight photos each for ten candidates
 * is slow and expensive, and adds little over two good angles.
 */
export function readReferenceImages(landmark: Landmark, limit = REFS_PER_CANDIDATE) {
  const paths = (landmark.reference_images ?? []).slice(0, limit);
  return paths.flatMap((p) => {
    try {
      const file = join(process.cwd(), 'public', p.replace(/^\//, ''));
      return [
        {
          inlineData: {
            mimeType: p.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg',
            data: readFileSync(file).toString('base64'),
          },
        },
      ];
    } catch {
      // A missing file must not take the whole request down. The candidate
      // simply goes in with fewer photos.
      return [];
    }
  });
}

/** Splits a data URL into the pieces the SDK wants. */
export function parseDataUrl(dataUrl: string): { mimeType: string; data: string } {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new HttpError(400, 'frame must be a base64 data URL.');
  return { mimeType: match[1], data: match[2] };
}

// ── Request plumbing ────────────────────────────────────────────────────────

/** Minimal shape shared by Vercel's req/res and Node's own. */
export interface ApiRequest {
  method?: string;
  body?: unknown;
}
export interface ApiResponse {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
}

export function readJsonBody<T>(req: ApiRequest): T {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body) as T;
    } catch {
      throw new HttpError(400, 'Body is not valid JSON.');
    }
  }
  if (req.body && typeof req.body === 'object') return req.body as T;
  throw new HttpError(400, 'Missing request body.');
}

/** Wraps a handler so every thrown error becomes a clean JSON response. */
export function handleErrors(
  fn: (req: ApiRequest, res: ApiResponse) => Promise<void>,
): (req: ApiRequest, res: ApiResponse) => Promise<void> {
  return async (req, res) => {
    try {
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Use POST.' });
        return;
      }
      await fn(req, res);
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      const message = err instanceof Error ? err.message : 'Unknown error.';
      // Logged server-side, where the detail is safe to keep.
      console.error('[api]', message);
      res.status(status).json({ error: message, model: MODEL });
    }
  };
}
