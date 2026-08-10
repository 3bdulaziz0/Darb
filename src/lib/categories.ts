/**
 * OWNER: shared. Small, stable, and imported by both C's screens.
 *
 * DONE:  the display name in both languages and a pin colour for every
 *        category.
 * TODO:  nothing. To add a category, add it to the Category union in types.ts
 *        and add its entry below — TypeScript will point at this file until
 *        you do, because CATEGORY_META must cover every member of the union.
 *
 * DISPLAY AND FILTERING ONLY. Nothing here ever reaches recognition. A category
 * is what we show the visitor, never a hint we give the matcher — see the note
 * on Landmark.category in types.ts.
 *
 * Nothing here is a historical claim either. "Religious" is a shelf label, not
 * a fact about a building, so it needs no source badge. Anything that asserts
 * *when* or *why* something was built belongs in `facts`, with its source.
 */

import type { Category, Lang } from './types';

export interface CategoryMeta {
  label_ar: string;
  label_en: string;
  /**
   * Pin colour for the discovery map, and the tint used by category chips.
   *
   * A hex string rather than a Tailwind class because these are chosen by
   * data at runtime — Tailwind can only see class names it can read in the
   * source, so `bg-${colour}` would silently produce no styles at all.
   */
  color: string;
}

/**
 * Every category, with its display names and colour.
 *
 * Typed as Record<Category, …>, so leaving one out is a compile error. The
 * order of the keys below is the order the filter chips appear in.
 */
export const CATEGORY_META: Record<Category, CategoryMeta> = {
  heritage: { label_ar: 'تراثي', label_en: 'Heritage', color: '#E4C89A' },
  religious: { label_ar: 'ديني', label_en: 'Religious', color: '#A9C0E8' },
  archaeological: { label_ar: 'أثري', label_en: 'Archaeological', color: '#D9A066' },
  museum: { label_ar: 'متحف', label_en: 'Museum', color: '#C9BEFF' },
  market: { label_ar: 'سوق', label_en: 'Market', color: '#E9A8B8' },
  natural: { label_ar: 'طبيعي', label_en: 'Natural', color: '#9FD3A8' },
  modern: { label_ar: 'حديث', label_en: 'Modern', color: '#A0A0AE' },
};

/**
 * All categories in display order.
 *
 * Derived from CATEGORY_META rather than written out again, so it can never
 * drift out of sync with the type.
 */
export const CATEGORIES = Object.keys(CATEGORY_META) as Category[];

/** The display name for a category in the active language. */
export function categoryLabel(category: Category, lang: Lang): string {
  const meta = CATEGORY_META[category];
  return lang === 'ar' ? meta.label_ar : meta.label_en;
}

/** The pin / chip colour for a category. */
export function categoryColor(category: Category): string {
  return CATEGORY_META[category].color;
}

/**
 * True if a string from outside the app is really one of our categories.
 *
 * The union catches typos in *our* code at compile time; landmarks.json is
 * plain data, so this is what catches them there. Used by loadLandmarks().
 */
export function isCategory(value: unknown): value is Category {
  // hasOwnProperty via the prototype, not `value in CATEGORY_META` — otherwise
  // 'toString' and 'constructor' would both pass as categories.
  return (
    typeof value === 'string' && Object.prototype.hasOwnProperty.call(CATEGORY_META, value)
  );
}
