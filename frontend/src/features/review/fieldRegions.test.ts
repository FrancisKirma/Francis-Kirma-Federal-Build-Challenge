import { describe, expect, it } from "vitest";

import { FIELD_REGIONS, zoomFor } from "./fieldRegions";
import { FIELD_ORDER } from "../../types";

describe("field regions", () => {
  it("covers every field the tool compares", () => {
    for (const field of FIELD_ORDER) {
      expect(FIELD_REGIONS[field]).toBeDefined();
    }
  });

  it("keeps every region inside the panel", () => {
    for (const [field, region] of Object.entries(FIELD_REGIONS)) {
      expect(region.x, field).toBeGreaterThanOrEqual(0);
      expect(region.y, field).toBeGreaterThanOrEqual(0);
      expect(region.x + region.w, field).toBeLessThanOrEqual(100);
      expect(region.y + region.h, field).toBeLessThanOrEqual(100);
    }
  });

  it("puts the measures side by side rather than overlapping", () => {
    const abv = FIELD_REGIONS.alcohol_content;
    const net = FIELD_REGIONS.net_contents;
    expect(abv).toBeDefined();
    expect(net).toBeDefined();
    if (abv === undefined || net === undefined) return;
    expect(abv.x + abv.w).toBeLessThanOrEqual(net.x);
  });

  it("zooms less for the warning, which is a block rather than a line", () => {
    expect(zoomFor("government_warning")).toBeLessThan(zoomFor("brand_name"));
  });
});
