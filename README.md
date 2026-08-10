# Rawi (راوي)

A mobile-first web app: point your camera at a heritage landmark, get its
verified story — with a visible source under every fact. When the landmark is
not in our curated library, the app says so and describes only what it can
actually see. It never guesses.

**Facts are retrieved from a curated library. Only the phrasing is generated.**
That separation is the product. See [CLAUDE.md](CLAUDE.md) before writing code.

---

## Setup

```bash
npm install
```

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

To demo the refusal path, tap the dashed **DEV · FORCE NO MATCH** chip on the
camera screen, then tap the shutter. It forces the stub to return
`match_id: null`, and the setting survives "Retake photo" so you can run the
loop repeatedly. It is temporary scaffolding — it goes out with
`src/lib/mockData.ts` before the demo build.

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
6. It lands on Masmak Fort, because `recognize()` is still a stub and always
   returns that. Tap the dashed **DEV** chip and shoot again for the refusal.

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
