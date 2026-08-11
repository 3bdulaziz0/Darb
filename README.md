# درب · Darb

A mobile-first web app: point your camera at a heritage landmark, get its
verified story — with a visible source under every fact. When the landmark is
not in our curated library, the app says so and describes only what it can
actually see. It never guesses.

**Facts are retrieved from a curated library. Only the phrasing is generated.**
That separation is the product. See [WORKING-AGREEMENT.md](WORKING-AGREEMENT.md) before writing code.

---

## Setup

```bash
npm install
```

Then create your `.env`:

```bash
cp .env.example .env
```

Put your Gemini key in it. **The variable has no `VITE_` prefix, and that is
deliberate** — Vite inlines every `VITE_` variable into the JavaScript it ships
to the browser, so a key with that prefix is published, not secret. Without the
prefix it is only visible to the serverless functions in `api/`, which is the
only place the model is ever called from.

Get a key at https://aistudio.google.com/apikey. On the hosting platform, set
`GEMINI_API_KEY` in the project's environment variables — never in the repo.

No key? The app still runs. Recognition returns a clear error, and you can set
`VITE_DARB_USE_STUB=1` in `.env` to use the offline stub instead.

```bash
npm run dev
```

Open http://localhost:5173. Every route renders with mock data — no API key, no
camera, no GPS needed.

| Route | Screen |
|---|---|
| `/` | Camera viewfinder — tap the shutter to run the recognition stub |
| `/story/lm_masmak` | Verified story with source badges |
| `/not-found` | Honest mode — "I don't recognise this building" |
| `/discover` | Radius discovery (1 / 5 / 20 km) |
| `/settings` | Language, voice, reading speed |

## The model

Two serverless functions, both in `api/`, both reading the key server-side:

| Endpoint | Does |
|---|---|
| `POST /api/recognize` | Identifies the photo against a candidate list, or refuses |
| `POST /api/ask` | Answers a follow-up strictly from that landmark's stored facts |
| `POST /api/speak` | Reads the story aloud in one of four model voices |

`npm run dev` serves them too, through a small plugin in `vite.config.ts`, so
the app behaves the same locally as deployed.

Recognition can only ever return one of the ids the client submitted, and only
those flagged `test_ready` are ever submitted. Anything else, including a
sub-threshold confidence, becomes `match_id: null` and routes to the refusal
screen. Both rules are enforced on the server and again on the client.

To demo the refusal path, photograph something that is not one of the ten
test-ready landmarks. That is the real path, and it is the one worth showing.

Other scripts:

```bash
npm test
```

Covers the pure helpers in `src/lib/library.ts` — distance, radius filtering,
and the validation of `landmarks.json`. No network, no mocking. If you add a
landmark and the suite goes red, the file has a problem: the error names the
entry and the field.

```bash
npm run typecheck
```

```bash
npm run build
```

---

## Deploying

The app is a static site plus three serverless functions. It is configured for
Vercel in `vercel.json`, and the same shape works on any host that serves a
folder and runs functions from `api/`.

1. Import the repository on the hosting platform. `vercel.json` already sets
   the build command, the output directory, the SPA fallback and a 60-second
   function timeout — recognition with several candidates takes a few seconds.
2. Set **`GEMINI_API_KEY`** in the project's environment variables, for every
   environment you intend to use. It is the only required one. `GEMINI_MODEL`,
   `GEMINI_TTS_MODEL` and `DARB_CONFIDENCE_THRESHOLD` are optional overrides.
   Never put the key in the repository.
3. Deploy, then open the URL on a real phone and check the camera, since that
   is the one thing localhost cannot prove.

### Why the functions fetch their own files

`api/_shared.ts` loads `landmarks.json` and the reference photographs over
HTTPS from the deployment's own origin, rather than reading them off disk.

A serverless function is bundled separately from the static files. `public/`
goes to the CDN and is **not** in the function's filesystem, so `readFileSync`
would work locally and throw `ENOENT` in production. Fetching also keeps the
function small: 108 MB of photographs stay on the CDN instead of being packed
into a bundle with a 250 MB ceiling. Both are cached in module scope, so a warm
function pays the cost once.

The origin is read from the request headers, so a preview deployment fetches
its own assets rather than production's.

---

## ⚠️ Camera and geolocation need HTTPS

`getUserMedia` and the Geolocation API only work in a **secure context**.
`http://localhost:5173` counts as secure on your own machine — but the moment
you open the dev server from your phone over the LAN
(`http://192.168.x.x:5173`), it does not, and both APIs fail **silently**. No
error, no prompt, just a black rectangle.

This costs teams a full day of confused debugging. It is the single most
predictable way to lose time on this project.

**So: test on the deployment preview URL, not on localhost.** Push the branch,
wait for the preview build, open that HTTPS URL on a real phone. From day 2
onward the preview deployment — not your laptop — is the primary test target,
and everyone tests on an actual device rather than a desktop emulator.

If you really need the camera locally, add
[`@vitejs/plugin-basic-ssl`](https://npmjs.com/package/@vitejs/plugin-basic-ssl)
to `vite.config.ts` and accept the self-signed certificate warning on the phone.
It is fiddly. The preview URL is easier.

### Testing the camera on your phone

1. Push the branch. Wait for the preview build to finish.
2. Open the **`https://`** preview URL on the phone — not `192.168.x.x:5173`.
3. Allow **camera**, then allow **location**. Two separate prompts.
4. The rear camera should fill the screen and the pill top-start should change
   from `LOCATING…` to `±N M`.
5. Tap the shutter. The frame freezes, dims, and the Arabic stages run.
6. Point it at one of the ten test-ready landmarks for a match, or at
   anything else to see the refusal.

If the screen stays black and you see "This page is not secure", you are on
`http://`. That is the HTTPS problem above, not a bug.

---

## Structure

```
src/
  App.tsx                        router + layout shell
  pages/
    CameraPage.tsx               A — viewfinder, capture, status stages
    StoryPage.tsx                C — verified story sheet
    NotFoundLandmarkPage.tsx     C — honest mode, the refusal screen
    DiscoveryPage.tsx            C — radius discovery
    SettingsPage.tsx             C — language, voice, speed
  lib/
    types.ts                     frozen — shared types + the rule-2 guard
    library.ts                   D — loader, haversine, radius filtering
    recognize.ts                 B — recognition stub
    mockData.ts                  shared — dev scaffolding, delete before demo
  components/
    SourceBadge.tsx              shared — the source pill + <SourcedFact/>
    StatusIndicator.tsx          A — locating / matching / fetching
    LandmarkCard.tsx             C — discovery list row
public/
  landmarks.json                 D — the curated library
  images/                        placeholder art
```

Every file opens with a comment block naming its owner, what is done, and what
is TODO. Start with the one you own.

## Adding a landmark

Append an entry to `public/landmarks.json`. Coordinates, at least one fact with
a resolvable `source_url`, and distinctive `visual_markers`. No code changes —
that is the design.

The two entries currently in the file are **structural placeholders**. Their
names and coordinates are real; their fact text is not — it says `PLACEHOLDER`
and points at `example.org` on purpose. Nothing ships until teammate D replaces
them with sourced facts (T-2).
