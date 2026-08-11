// api/recognize.js — Rawi recognition gateway  (Owner: B)
//
// DONE: server-side Gemini call, strict JSON, candidate-bounded matching,
//       confidence threshold -> null, defensive parsing, timeout.
// TODO: none for the MVP. Tune CONFIDENCE_THRESHOLD on day-4 test photos.
//
// WHY THIS FILE EXISTS (see CLAUDE.md rule 4):
//   The browser must never call Gemini directly — the API key would be exposed
//   and the grounding prompt could be tampered with. Every model call goes
//   through here. This function receives ONLY candidate ids + visual_markers
//   (never names, dates, category or tags) and returns a MatchResult:
//       { match_id: string | null, confidence: number, elements_seen: string[] }
//
// The model is asked to behave; THIS CODE enforces it:
//   - any match_id not in the submitted candidate list  -> null
//   - any confidence below the threshold                -> null
//
// Runs on Vercel (Node serverless). Set these in the Vercel project env:
//   GEMINI_API_KEY        (required)  — server-side only, never shipped to client
//   GEMINI_MODEL          (optional)  — the model you validated in AI Studio,
//                                       e.g. a current flash model. Default below.
//   CONFIDENCE_THRESHOLD  (optional)  — default 0.8 (PRD start value)

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const THRESHOLD = Number(process.env.CONFIDENCE_THRESHOLD ?? 0.8);
const TIMEOUT_MS = 15000;

// Keep this in sync with prompts.txt (the reviewed source of truth).
const SYSTEM_PROMPT = `You are the recognition engine for Rawi, a heritage-landmark guide.

You will be given ONE photograph and a JSON array called CANDIDATES. Each
candidate is an object with:
  - "id": an opaque identifier string
  - "visual_markers": short phrases describing features visible on that landmark

Your only task is to decide whether the photograph shows one of the candidates,
by comparing what is actually visible in the image against each candidate's
visual_markers.

RULES — follow every one:
1. Choose "match_id" ONLY from the ids in CANDIDATES. Never output an id that is
   not in the list. Never invent one.
2. If no candidate clearly matches, set "match_id" to null. A weak, partial, or
   uncertain match is null — not a hedge. When unsure, refuse.
3. Use ONLY visual evidence from the photograph. Do not use outside knowledge.
   Do not read meaning into the id string. You do not know any landmark's name,
   date, or history — and must never produce one.
4. "confidence" is your visual-match certainty from 0 to 1.
5. "elements_seen" is 2 to 4 short, neutral descriptions of architectural
   elements actually visible in the photo (materials, shapes, openings). No
   names, no dates, no claims about the past.
6. If the image is too blurred, dark, or obstructed to judge, return match_id
   null with whatever elements are still visible (or an empty list).

Return JSON only, in exactly this shape:
{ "match_id": <string or null>, "confidence": <number 0..1>, "elements_seen": [<string>, ...] }`;

// Strict output schema handed to Gemini (uppercase types = REST convention).
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    match_id: { type: "STRING", nullable: true },
    confidence: { type: "NUMBER" },
    elements_seen: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["match_id", "confidence", "elements_seen"],
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: "server_misconfigured" });
  }

  // ---- read + validate the request ----------------------------------------
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  if (!body || typeof body !== "object") {
    return res.status(400).json({ error: "bad_request" });
  }

  const { image, candidates } = body;
  const mimeType = body.mimeType || "image/jpeg";

  if (typeof image !== "string" || image.length < 100) {
    return res.status(400).json({ error: "missing_image" });
  }
  if (!Array.isArray(candidates) || candidates.length === 0) {
    // No nearby candidates is a legitimate outcome, not an error: treat as a
    // refusal so the client shows honest mode instead of a crash.
    return res.status(200).json({ match_id: null, confidence: 0, elements_seen: [] });
  }

  // Strip a data-URL prefix if the client sent one, and keep only id + markers.
  const base64 = image.includes(",") ? image.slice(image.indexOf(",") + 1) : image;
  const allowedIds = new Set();
  const safeCandidates = [];
  for (const c of candidates) {
    if (!c || typeof c.id !== "string") continue;
    allowedIds.add(c.id);
    safeCandidates.push({
      id: c.id,
      visual_markers: Array.isArray(c.visual_markers) ? c.visual_markers : [],
    });
  }
  if (safeCandidates.length === 0) {
    return res.status(200).json({ match_id: null, confidence: 0, elements_seen: [] });
  }

  const userText = `${SYSTEM_PROMPT}\n\nCANDIDATES:\n${JSON.stringify(safeCandidates)}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const payload = {
    contents: [
      {
        parts: [
          { inline_data: { mime_type: mimeType, data: base64 } },
          { text: userText },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  };

  // ---- call Gemini with a timeout -----------------------------------------
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let data;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      console.error("Gemini error", r.status, detail.slice(0, 500));
      return res.status(502).json({ error: "recognition_failed" });
    }
    data = await r.json();
  } catch (err) {
    console.error("Gemini call threw", err?.name || err);
    const code = err?.name === "AbortError" ? "recognition_timeout" : "recognition_failed";
    return res.status(502).json({ error: code });
  } finally {
    clearTimeout(timer);
  }

  // ---- parse the model output defensively ---------------------------------
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  let parsed;
  try {
    parsed = JSON.parse(stripFences(text));
  } catch {
    console.error("Unparseable model output:", text.slice(0, 300));
    return res.status(502).json({ error: "recognition_failed" });
  }

  // ---- ENFORCE the rules in code (never trust the model) -------------------
  let matchId = typeof parsed.match_id === "string" ? parsed.match_id : null;
  let confidence = Number(parsed.confidence);
  if (!Number.isFinite(confidence)) confidence = 0;
  confidence = Math.max(0, Math.min(1, confidence));

  const elementsSeen = Array.isArray(parsed.elements_seen)
    ? parsed.elements_seen.filter((e) => typeof e === "string").slice(0, 4)
    : [];

  // Rule: an id outside the candidate list is impossible -> refuse.
  if (matchId !== null && !allowedIds.has(matchId)) matchId = null;
  // Rule: below threshold is a refusal, not a weak guess.
  if (matchId !== null && confidence < THRESHOLD) matchId = null;

  return res.status(200).json({
    match_id: matchId,
    confidence,
    elements_seen: elementsSeen,
  });
}

// responseMimeType should give clean JSON, but strip ```json fences just in case.
function stripFences(s) {
  return s.replace(/```json/gi, "").replace(/```/g, "").trim();
}
