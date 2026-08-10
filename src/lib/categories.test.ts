/**
 * OWNER: shared, alongside categories.ts.  Run with:  npm test
 */

import { describe, expect, it } from 'vitest';
import {
  CATEGORIES,
  CATEGORY_META,
  categoryColor,
  categoryLabel,
  isCategory,
} from './categories';

describe('CATEGORY_META', () => {
  it('covers all seven categories', () => {
    expect(CATEGORIES).toHaveLength(7);
  });

  it('gives every category a label in both languages and a colour', () => {
    for (const key of CATEGORIES) {
      const meta = CATEGORY_META[key];
      expect(meta.label_ar.trim()).not.toBe('');
      expect(meta.label_en.trim()).not.toBe('');
      expect(meta.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('gives each category its own colour, so pins stay distinguishable', () => {
    const colors = CATEGORIES.map(categoryColor);
    expect(new Set(colors).size).toBe(colors.length);
  });
});

describe('categoryLabel', () => {
  it('returns the English name', () => {
    expect(categoryLabel('religious', 'en')).toBe('Religious');
  });

  it('returns the Arabic name', () => {
    expect(categoryLabel('religious', 'ar')).toBe('ديني');
  });
});

describe('isCategory', () => {
  it('accepts a real category', () => {
    expect(isCategory('market')).toBe(true);
  });

  it('rejects a near miss', () => {
    expect(isCategory('religous')).toBe(false);
  });

  it('rejects things that are not strings at all', () => {
    expect(isCategory(undefined)).toBe(false);
    expect(isCategory(null)).toBe(false);
    expect(isCategory(7)).toBe(false);
  });

  it('is not fooled by inherited object properties', () => {
    // hasOwnProperty, not `in` — otherwise 'toString' would pass.
    expect(isCategory('toString')).toBe(false);
    expect(isCategory('constructor')).toBe(false);
  });
});
