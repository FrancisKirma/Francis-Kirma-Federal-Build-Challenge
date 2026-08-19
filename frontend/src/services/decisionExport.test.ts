import { describe, expect, it } from "vitest";

import { csvFilename, escapeCell, toCsv } from "./decisionExport";
import type { ApplicationSummary, Decision } from "../types";

const AT = "2026-08-19T14:30:00.000Z";

function application(
  id: string,
  applicant = "Old Tom Distillery LLC",
): ApplicationSummary {
  return {
    application_id: id,
    applicant,
    submitted_date: "2024-03-11",
    beverage_type: "distilled_spirits",
    artwork: `labels/${id}.png`,
    submitted: {
      brand_name: "OLD TOM DISTILLERY",
      class_type: "Kentucky Straight Bourbon Whiskey",
      alcohol_content: "45% Alc./Vol.",
      net_contents: "750 mL",
      government_warning: true,
    },
  };
}

function decision(over: Partial<Decision> = {}): Decision {
  return { status: "approved", decidedAt: AT, flaggedFields: [], ...over };
}

describe("escapeCell", () => {
  it("quotes every value so commas in names cannot split a row", () => {
    expect(escapeCell("Stone's Throw Spirits Co., Inc.")).toBe(
      `"Stone's Throw Spirits Co., Inc."`,
    );
  });

  it("doubles embedded quotes rather than truncating the value", () => {
    expect(escapeCell('He said "no"')).toBe('"He said ""no"""');
  });

  it("keeps a leading = inert so a spreadsheet does not run it as a formula", () => {
    expect(escapeCell("=1+1")).toBe(`"'=1+1"`);
  });

  it("does the same for the other formula prefixes", () => {
    for (const value of ["+1", "-1", "@SUM(A1)"]) {
      expect(escapeCell(value)).toContain("'");
    }
  });

  it("leaves ordinary text alone apart from quoting", () => {
    expect(escapeCell("Approved")).toBe('"Approved"');
  });
});

describe("toCsv", () => {
  it("exports only applications that have been decided", () => {
    const csv = toCsv(
      [application("TTB-2024-0041"), application("TTB-2024-0042")],
      new Map([["TTB-2024-0041", decision()]]),
      AT,
    );
    expect(csv).toContain("TTB-2024-0041");
    expect(csv).not.toContain("TTB-2024-0042");
  });

  it("writes a header row so the file reads without the app", () => {
    const csv = toCsv([], new Map(), AT);
    expect(csv.split("\r\n")[0]).toContain("application_id");
    expect(csv.split("\r\n")[0]).toContain("fields_not_matching");
  });

  it("records what disagreed, in words rather than API field names", () => {
    const csv = toCsv(
      [application("TTB-2024-0044")],
      new Map([
        [
          "TTB-2024-0044",
          decision({ flaggedFields: ["government_warning", "net_contents"] }),
        ],
      ]),
      AT,
    );
    expect(csv).toContain("Government warning; Net contents");
    expect(csv).not.toContain("government_warning");
  });

  it("distinguishes an approval over problems from a clean one", () => {
    const csv = toCsv(
      [application("TTB-2024-0041"), application("TTB-2024-0044")],
      new Map([
        ["TTB-2024-0041", decision()],
        ["TTB-2024-0044", decision({ flaggedFields: ["government_warning"] })],
      ]),
      AT,
    );
    const [, clean, flagged] = csv.split("\r\n");
    expect(clean).toContain('""');
    expect(flagged).toContain("Government warning");
  });

  it("uses CRLF so the file opens correctly in Excel", () => {
    const csv = toCsv([application("A")], new Map([["A", decision()]]), AT);
    expect(csv).toContain("\r\n");
  });

  it("survives an applicant name containing a comma and a quote", () => {
    const csv = toCsv(
      [application("A", 'Stone\'s "Throw", Inc.')],
      new Map([["A", decision()]]),
      AT,
    );
    // Header plus exactly one data row: the name did not split the row.
    expect(csv.split("\r\n")).toHaveLength(2);
  });

  it("stamps every row with when the export was taken", () => {
    const csv = toCsv([application("A")], new Map([["A", decision()]]), AT);
    expect(csv).toContain(AT);
  });
});

describe("csvFilename", () => {
  it("dates the file so successive exports do not overwrite", () => {
    expect(csvFilename(AT)).toBe("ttb-decisions-2026-08-19.csv");
  });
});
