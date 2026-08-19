/**
 * Where each field sits on the 600x800 fixture front panel, as percentages.
 *
 * Derived from the geometry in `tools/label_template.html` (44px top padding,
 * 40px sides, 34px bottom, brand offset 54px, measures then warning at the
 * foot) -- not from reading the image. They are therefore only valid for
 * generated fixture artwork, and the UI says the region is approximate.
 *
 * For real COLA artwork these should be replaced by word-level OCR coordinates
 * fuzzy-matched to each extracted value, the approach sketched in the repo
 * README's Future Work.
 */
export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const FIELD_REGIONS: Record<string, Region> = {
  brand_name: { x: 6.7, y: 10.5, w: 86.6, h: 9.5 },
  class_type: { x: 11, y: 23, w: 78, h: 6.5 },
  alcohol_content: { x: 6.7, y: 80.5, w: 34, h: 3.8 },
  net_contents: { x: 59, y: 80.5, w: 34, h: 3.8 },
  government_warning: { x: 6.7, y: 85.5, w: 86.6, h: 11 },
};

/** How far to zoom for a field. The warning is a block, so it needs less. */
export function zoomFor(field: string): number {
  return field === "government_warning" ? 1.8 : 2.4;
}
