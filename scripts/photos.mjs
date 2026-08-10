/**
 * OWNER: teammate D (data).
 *
 * Run with:  npm run photos
 *
 * Does two things, and is safe to run as often as you like:
 *
 *   1. Makes sure every landmark in public/landmarks.json has a photo folder
 *      at public/landmarks/<id>/.
 *   2. Looks in each folder, and writes what it finds into that landmark's
 *      `reference_images`, so the app and the recogniser can see the photos.
 *
 * You never edit landmarks.json by hand for photos. Drop the files in the
 * folder, run this, done. See public/landmarks/README.md.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const LIBRARY = join(ROOT, 'public', 'landmarks.json');
const PHOTOS = join(ROOT, 'public', 'landmarks');

/** Extensions a browser will actually display. */
const IMAGE = /\.(jpe?g|png|webp|avif)$/i;
/** Above this, a reference photo is wasting everyone's mobile data. */
const BIG_FILE_MB = 2;
/** Shown wherever a landmark has no photo of its own. */
const PLACEHOLDER = '/images/placeholder.jpg';

const landmarks = JSON.parse(readFileSync(LIBRARY, 'utf8'));

let created = 0;
let withPhotos = 0;
let totalPhotos = 0;
let totalBytes = 0;
const oversized = [];
const missing = [];
/** Folders with photos whose landmark is not flagged test_ready. */
const heldBack = [];

for (const landmark of landmarks) {
  const dir = join(PHOTOS, landmark.id);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    created += 1;
  }

  // Git will not track an empty directory, so each one keeps a marker file.
  const keep = join(dir, '.gitkeep');
  if (!existsSync(keep)) writeFileSync(keep, '');

  const files = readdirSync(dir)
    .filter((name) => IMAGE.test(name))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

  for (const name of files) {
    const bytes = statSync(join(dir, name)).size;
    totalBytes += bytes;
    if (bytes > BIG_FILE_MB * 1024 * 1024) {
      oversized.push(`${landmark.id}/${name} (${(bytes / 1024 / 1024).toFixed(1)} MB)`);
    }
  }

  // This script owns `image` only while it points into the photo folder. A
  // hand-set path like /images/lm_masmak.jpg is somebody's deliberate choice
  // and is left alone.
  const ours = `/landmarks/${landmark.id}/`;
  const imageIsOurs = typeof landmark.image === 'string' && landmark.image.startsWith(ours);
  // Most of the bulk library points at /images/<id>.jpg files that were never
  // shot. A path to a file that does not exist is not a deliberate choice, so
  // we are free to replace it with a real photo.
  const imageIsDead =
    !landmark.image || !existsSync(join(ROOT, 'public', landmark.image.replace(/^\//, '')));

  // Photos on disk are not the same thing as photos in the test set. Only
  // entries a human has flagged `test_ready` get linked, so dropping a folder
  // of images in never silently enlarges what recognition is judged on.
  if (files.length > 0 && !landmark.test_ready) {
    delete landmark.reference_images;
    if (imageIsOurs) landmark.image = PLACEHOLDER;
    heldBack.push({ id: landmark.id, count: files.length });
    continue;
  }

  if (files.length > 0) {
    landmark.reference_images = files.map((name) => `${ours}${name}`);
    // The first photo becomes the one shown on the card and the story page,
    // unless someone deliberately pointed at a real file elsewhere.
    if (imageIsOurs || imageIsDead) landmark.image = landmark.reference_images[0];
    withPhotos += 1;
    totalPhotos += files.length;
  } else {
    delete landmark.reference_images;
    // The photos we were pointing at are gone — do not leave a dead path.
    if (imageIsOurs) landmark.image = PLACEHOLDER;
    missing.push(landmark);
  }
}

writeFileSync(LIBRARY, JSON.stringify(landmarks, null, 2) + '\n', 'utf8');

// ── Report ──────────────────────────────────────────────────────────────────

const recognisable = (l) =>
  (l.visual_markers?.length ?? 0) > 0 || (l.reference_images?.length ?? 0) > 0;

console.log('');
if (created) console.log(`created ${created} new photo folder(s)`);
console.log(`landmarks              : ${landmarks.length}`);
console.log(`with photos            : ${withPhotos}`);
console.log(`without photos         : ${missing.length}`);
console.log(`photos on disk         : ${totalPhotos} (${(totalBytes / 1024 / 1024).toFixed(1)} MB)`);
console.log(`recognisable by the AI : ${landmarks.filter(recognisable).length}`);
console.log(`flagged test_ready     : ${landmarks.filter((l) => l.test_ready).length}`);

if (heldBack.length) {
  const total = heldBack.reduce((n, h) => n + h.count, 0);
  console.log('');
  console.log(`${total} photo(s) in ${heldBack.length} folder(s) are on disk but NOT linked,`);
  console.log('because those landmarks are not flagged test_ready. Add');
  console.log('"test_ready": true to an entry in landmarks.json to bring it in.');
}

if (oversized.length) {
  console.log('');
  console.log(`⚠ ${oversized.length} photo(s) over ${BIG_FILE_MB} MB — shrink these before committing:`);
  oversized.slice(0, 10).forEach((f) => console.log(`   ${f}`));
  if (oversized.length > 10) console.log(`   …and ${oversized.length - 10} more`);
}

// Landmarks that have markers but no photos are the ones worth shooting next:
// they are already half-curated.
const halfCurated = missing.filter((l) => (l.visual_markers?.length ?? 0) > 0);
if (halfCurated.length) {
  console.log('');
  console.log('these have visual markers but no photos yet:');
  halfCurated.forEach((l) => console.log(`   ${l.id}  (${l.name_en})`));
}

console.log('');
console.log(`drop photos into ${relative(ROOT, PHOTOS)}\\<id>\\ and run this again.`);
console.log('');
