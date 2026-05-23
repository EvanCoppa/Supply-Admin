import { describe, expect, it } from 'vitest';
import { NAV_ITEMS, NAV_SECTIONS } from './nav';

describe('NAV_SECTIONS', () => {
  it('has headings and at least one item per section', () => {
    expect(NAV_SECTIONS.length).toBeGreaterThan(0);
    for (const section of NAV_SECTIONS) {
      expect(section.heading).toBeTruthy();
      expect(section.items.length).toBeGreaterThan(0);
    }
  });

  it('all items have label + href and unique hrefs', () => {
    const hrefs = new Set<string>();
    for (const section of NAV_SECTIONS) {
      for (const item of section.items) {
        expect(item.label).toBeTruthy();
        expect(item.href.startsWith('/')).toBe(true);
        expect(hrefs.has(item.href)).toBe(false);
        hrefs.add(item.href);
      }
    }
  });
});

describe('NAV_ITEMS', () => {
  it('flattens all section items', () => {
    const expected = NAV_SECTIONS.reduce((sum, s) => sum + s.items.length, 0);
    expect(NAV_ITEMS.length).toBe(expected);
  });
});
