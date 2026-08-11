# Rawi — working agreement

**Point and learn — and when we don't know, we'll tell you.**

Rawi identifies heritage landmarks from a photo and tells their verified story,
with a visible source under every fact. Its defining behaviour is not what it
knows — it is what it refuses to say.

Read this file before you touch anything.

---

## The one rule that outranks the others

**Never edit a file you don't own.**

If you need a change in someone else's file, ask them. If you need a change in a
shared file, say so in the group chat before you make it. The ownership table is
below and it is not advisory — four people editing five files for five days only
works if nobody reaches across the line.

---

## File ownership

| File | Owner | What it is |
|---|---|---|
| `src/App.tsx` | **A** | Router + layout shell |
| `src/pages/CameraPage.tsx` | **A** | Live camera, capture, status stages |
| `src/components/StatusIndicator.tsx` | **A** | Three-stage progress indicator |
| `src/lib/location.ts` | **A** | Device position, typed result, never throws |
| `src/lib/recognize.ts` | **B** | Recognition call — currently a stub |
| `src/pages/StoryPage.tsx` | **C** | Verified story sheet |
| `src/pages/NotFoundLandmarkPage.tsx` | **C** | Honest mode — the refusal screen |
| `src/pages/DiscoveryPage.tsx` | **C** | Radius discovery, list, empty state |
| `src/pages/SettingsPage.tsx` | **C** | Language, voice, speed |
| `src/components/LandmarkCard.tsx` | **C** | Discovery list row |
| `public/landmarks.json` | **D** | The curated library — the whole product |
| `src/lib/library.ts` | **D** | Loader, distance, radius filtering |
| `src/lib/types.ts` | **frozen** | Shared types. Changing one changes everyone's work |
| `src/lib/categories.ts` | **shared** | Category labels (ar/en) + map pin colours |
| `src/lib/i18n.ts` | **C** | Every interface string, both languages |
| `src/lib/favourites.ts` | **C** | Starred landmarks, localStorage |
| `src/lib/voices.ts` | **shared** | The four narration voices |
| `src/lib/narration.ts` | **C** | Chosen voice + speed, session-scoped |
| `src/components/PhotoCarousel.tsx` | **C** | Reference-photo gallery |
| `src/components/FavouriteStar.tsx` | **C** | The star toggle |
| `src/components/SourceBadge.tsx` | **shared** | Rule 2 lives here — review any change |
| `src/lib/mockData.ts` | **shared** | Dev scaffolding. Delete before the demo |

Every file starts with a comment block naming its owner, what is done, and
what is still TODO. Keep those blocks current — they are how the other three
people know where you are without asking.

---

## Data contract (fixed)

This shape is settled. `public/landmarks.json` is an array of `Landmark`.

```ts
Landmark {
  id: string
  name_ar: string
  name_en: string
  lat: number
  lng: number
  image: string
  facts: Fact[]
  elements: string[]        // architectural element keys — NOT historical claims
  visual_markers: string[]  // recognition cues — never rendered as a fact
  category: Category        // display + filtering only — NEVER sent to recognition
  tags?: string[]           // optional keywords, same rule as category
  city?: string             // display + filtering only, same rule
}

Category =
  | 'heritage' | 'religious' | 'archaeological'
  | 'museum'   | 'market'    | 'natural' | 'modern'

Fact {
  text_ar: string          // either side may be empty while untranslated
  text_en: string          // but never both
  source_name: string
  source_url: string
  source_url_ar?: string   // publisher's own Arabic page, set by a script
}

MatchResult {
  match_id: string | null   // null = we do not recognise it
  confidence: number
  elements_seen: string[]
}
```

Adding a landmark is a **data** operation. It means appending to
`landmarks.json`. It never means changing code.

### Curated vs listed

The library holds 190 landmarks across 19 cities, but only the ones with
**`visual_markers`** are offered to recognition. `selectCandidates()` filters
on `isRecognisable()`, and that filter is load bearing: handing the matcher a
candidate it has no way to identify invites it to pick on name or category
alone — a confident wrong match, the one failure this product exists to
prevent.

So an entry has two tiers, and the difference is `visual_markers`:

| Tier | Appears in discovery | Has a story page | Offered to recognition |
|---|---|---|---|
| Listed (no markers) | yes | yes | **no** |
| Curated (has markers) | yes | yes | yes |

Promoting an entry means giving it something to be recognised BY — written
`visual_markers`, reference photographs, or both — **and** flagging it
`"test_ready": true`.

The flag is a curation decision, not a place type, which is why it is separate
from `category`. `npm run photos` links reference photographs for flagged
entries only, so dropping a folder of images in never silently enlarges what
the matcher is judged on. Photos for unflagged landmarks sit on disk, are
gitignored, and the script reports how many are waiting.

The story page shows every reference photo as a swipeable gallery, so the
folder's contents are what a visitor browses. Shoot accordingly.

Photos live in `public/landmarks/<id>/`, one folder per landmark. Drop the
files in and run `npm run photos`; the script writes `reference_images` into
`landmarks.json` and prints what is still missing. Never hand-edit that field.
See `public/landmarks/README.md` — it is written for a curator, not a
developer.

### Language

`src/lib/i18n.ts` holds every interface string in both languages, and nothing
else. It must never hold a landmark name, a date, or a description — those are
library data with sources attached.

Arabic is the default. Switching language sets `dir` on `<html>` and nothing
more; the layout mirrors on its own because every screen uses logical
properties. If a screen looks wrong in Arabic, something used `pl-`/`left-`.

Adding a string means adding it to **both** objects — `ar` is typed as
`Record<keyof typeof en, string>`, so forgetting one is a compile error.

### Translation pending

`name_ar` and one side of a `Fact` may be an empty string while a translation
is pending. A fact must still carry text in **at least one** language, and
always its source. `<SourcedFact/>` renders the language we have and labels it
"translation pending" — it never machine-translates the missing one into
existence, and never renders a blank where a fact should be.

**We do not translate facts. Ever.** Not by hand, not with a model. A fact in
Arabic must be written from an Arabic source by a human. `npm run sources:ar`
fills in `source_url_ar` so an Arabic reader reaches the publisher's own
Arabic page — it rewrites links, never text. The badge follows the text: if
you are reading the English fact because Arabic is pending, it cites the
English page, because that is the page we are actually quoting.

`category` is a fixed union, so a typo fails to compile in our own code — and
because `landmarks.json` is data the compiler never sees, `loadLandmarks()`
rejects an unknown category at load with the entry and value named. Without
that check a misspelt category would simply vanish from every filter.

**Category and tags are display and filtering data. They must never be passed
to recognition.** Telling the matcher "this one is a mosque" biases it toward a
category instead of matching what is actually in the photograph — and a
confident wrong match is the failure this product exists to prevent.
Recognition receives candidate ids and visual markers, nothing else.

---

## The four rules

### 1. Facts come only from `landmarks.json`

No component may generate, guess, infer, or hardcode a historical fact. Not a
date, not a name of a person, not "built in the 19th century" as a filler
subtitle. If a string makes a claim about the past and it did not come out of
the library file, it is a bug — regardless of how good it looks.

The model's job is phrasing and translation. The library's job is facts. That
line is the product.

> This is why `StoryPage` does not build the "BUILT 1872 · GOTHIC STYLE" chips
> from the design mock. Those are historical claims with no source attached.
> The chips render `landmark.elements` instead.

### 2. Every fact on screen carries its source

This is enforced by the compiler, not by discipline.

`library.ts` seals every fact into a `SealedFact`, whose text fields are
`SourcedText` **objects**, not strings. React cannot render an object, and
TypeScript will not compile the attempt:

```tsx
<p>{fact.text_en}</p>
// Type 'SourcedText' is not assignable to type 'ReactNode'
```

The only place that unwraps a `SourcedText` is `<SourcedFact/>` in
`SourceBadge.tsx`, and it renders the text and the `<SourceBadge/>` together in
one element. So there is no code path that puts a fact on screen without its
source, because there is nowhere else to unwrap it.

A fact whose `source_url` is missing is dropped by `sealFacts()`, not rendered
bare.

This is a compile-time guard, not a sandbox. Someone determined can still reach
in and read `.text` — that is a deliberate, greppable act, and it will be caught
in review. The point is that you cannot do it by accident.

### 3. `match_id: null` routes to the refusal screen

`CameraPage` sends a null match to `/not-found` and passes **only** the captured
frame and the observed element keys. No landmark id, no candidate list, no
"closest guess" travels with it.

`NotFoundLandmarkPage` **must never display a name, a date, or a story.** It
deliberately does not import `library.ts` or `SourcedFact` — there is no
landmark in scope on that page and there must not be one.

Confidence below the threshold is a refusal, not a hedged answer. Never soften
this into "we think this might be…".

### 4. The model is called from the server, never the browser

`src/lib/recognize.ts` posts to `/api/recognize`; the handler in `api/` holds
the key and the grounding prompt. Both are out of reach of anyone using the
app — a prompt the client could edit is a guarantee the client could remove.

The key lives in `.env` with **no `VITE_` prefix**. Anything prefixed `VITE_`
is compiled into the browser bundle in plain text. Check with:

```bash
npm run build && grep -r GEMINI dist/assets/
```

That must print nothing.

Four rules hold on every recognition, enforced server-side and again on the
client, because the cost of one confident wrong match is the whole product:

1. Only ids the client submitted, resolved against the server's own copy of
   the library, are ever candidates.
2. The model sees names, visual markers and reference photographs — never
   facts, categories or cities.
3. Any `match_id` outside the submitted list is rejected after the answer.
4. Confidence below the threshold becomes `match_id: null`.

Follow-up answers are bounded the same way: `api/ask.ts` sends only that
landmark's facts and requires the model to return which ones it used. An
answer citing nothing is returned as not-covered, because unsourced prose is
the thing this product exists to refuse.

---

## Style

- Dark only. Background `#0E0E12`, surfaces `#1A1A22`, accent violet `#6C4BF4`,
  heritage sand `#E4C89A` for scholarly metadata, white and `#A0A0AE` for text.
- Mobile-first. Everything works from 360px up.
- 44px minimum touch target — use the `.control` class for circular buttons.
  Source badges are 32px tall per the design system, with an invisible 44px tap
  area behind them.
- Rounded: `rounded-sheet` (20px) for cards and sheets, `rounded-ctl` (16px) for
  buttons and inputs.
- **Logical properties only.** `ps-` `pe-` `ms-` `me-` `start-` `end-`
  `text-start` `text-end` `border-s` `border-e`. Never `pl-` `pr-` `ml-` `mr-`
  `left-` `right-`. Arabic RTL should be a `dir="rtl"` on `<html>` and nothing
  else — if you use a physical property, you break that.

---

## Not in this build

Gemini calls · text-to-speech · language switching · accounts · storage ·
offline mode · in-app map routing · frame quality check · permission primer ·
manual district selection.

Live camera and real geolocation **are** built — see `CameraPage.tsx` and
`lib/location.ts`. Both need HTTPS, so test on the preview URL, not on a
local network address.

The structure is ready for all of them. Read the TODO block at the top of the
file you own — it lists yours in order.
