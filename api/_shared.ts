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
 *
 * ── Why the library is fetched rather than read off disk ───────────────────
 * These run as serverless functions, and a serverless function is bundled
 * separately from the site's static files. `public/` is uploaded to the CDN;
 * it is NOT in the function's filesystem, so readFileSync(process.cwd() +
 * '/public/...') works in local dev and throws ENOENT in production.
 *
 * Fetching over HTTPS from our own origin fixes that and keeps the function
 * small: 108 MB of reference photographs stay on the CDN instead of being
 * packed into a bundle with a 250 MB ceiling. Both the library and the photos
 * are cached in module scope, so a warm function pays the cost once.
 * ───────────────────────────────────────────────────────────────────────────
 */

import { GoogleGenAI } from '@google/genai';
import type { Landmark } from '../src/lib/types';

/** Below this, a match is not a match — it is a refusal (business rule 4). */
export const CONFIDENCE_THRESHOLD = Number(process.env.DARB_CONFIDENCE_THRESHOLD) || 0.8;

/** Conservative default. Override with GEMINI_MODEL once you know your access. */
export const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

/** At most this many reference photographs per candidate go into a prompt. */
export const REFS_PER_CANDIDATE = 2;

/** Give up on a static asset rather than hanging the whole request. */
const ASSET_TIMEOUT_MS = 8000;

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

// ── Where our own static files live ─────────────────────────────────────────

function headerValue(headers: ApiRequest['headers'], name: string): string | undefined {
  const raw = headers?.[name];
  return Array.isArray(raw) ? raw[0] : raw;
}

/**
 * The base URL of this deployment, taken from the request that arrived.
 *
 * Read from headers rather than a platform-specific variable so the same code
 * works on any host and on localhost, and so a preview deployment fetches its
 * own assets rather than production's.
 */
export function originFrom(req: ApiRequest): string {
  const host = headerValue(req.headers, 'x-forwarded-host') ?? headerValue(req.headers, 'host');

  if (host) {
    const proto =
      headerValue(req.headers, 'x-forwarded-proto') ??
      (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
    return `${proto}://${host}`;
  }

  // No request context to read — fall back to what the platform tells us.
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  throw new HttpError(500, 'Could not work out this site’s own address.');
}

async function fetchAsset(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ASSET_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new HttpError(502, `Could not load ${url} (${response.status}).`);
    return response;
  } finally {
    clearTimeout(timer);
  }
}

// ── The library ─────────────────────────────────────────────────────────────

let cached: { origin: string; data: Landmark[] } | null = null;

/**
 * Loads the curated library from our own static files.
 *
 * The client sends candidate ids, never landmark content. Everything the model
 * is allowed to see is read here, from the file we control — so a client
 * cannot inject a fake landmark, fake markers, or a fake fact.
 */
export async function loadLibrary(origin: string): Promise<Landmark[]> {
  if (cached?.origin === origin) return cached.data;

  const response = await fetchAsset(`${origin}/landmarks.json`);
  const data = (await response.json()) as Landmark[];
  cached = { origin, data };
  return data;
}

export async function findLandmark(origin: string, id: string): Promise<Landmark | undefined> {
  return (await loadLibrary(origin)).find((l) => l.id === id);
}

// ── Reference photographs ───────────────────────────────────────────────────

interface InlinePart {
  inlineData: { mimeType: string; data: string };
}

/** Photos never change within a deployment, so a warm function fetches once. */
const photoCache = new Map<string, InlinePart>();

/**
 * Fetches a landmark's reference photographs as base64.
 *
 * Capped per candidate: a prompt carrying eight photos each for ten candidates
 * is slow and expensive, and adds little over two good angles. A photo that
 * fails to load is skipped rather than failing the request — the candidate
 * simply goes in with fewer pictures.
 */
export async function readReferenceImages(
  origin: string,
  landmark: Landmark,
  limit = REFS_PER_CANDIDATE,
): Promise<InlinePart[]> {
  const paths = (landmark.reference_images ?? []).slice(0, limit);

  const parts = await Promise.all(
    paths.map(async (path): Promise<InlinePart | null> => {
      const cachedPart = photoCache.get(path);
      if (cachedPart) return cachedPart;

      try {
        const response = await fetchAsset(`${origin}${path}`);
        const buffer = await response.arrayBuffer();
        const part: InlinePart = {
          inlineData: {
            mimeType: path.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg',
            data: Buffer.from(buffer).toString('base64'),
          },
        };
        photoCache.set(path, part);
        return part;
      } catch {
        return null;
      }
    }),
  );

  return parts.filter((p): p is InlinePart => p !== null);
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
  headers?: Record<string, string | string[] | undefined>;
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
