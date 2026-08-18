import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BatchResults } from "./BatchResults";
import type { BatchOutcome, Decision, VerificationResponse } from "../../types";

function verified(flagged: boolean): VerificationResponse {
  return {
    application_id: "x",
    flagged,
    elapsed_seconds: 2,
    fields: [
      {
        field: "brand_name",
        claimed: "A",
        extracted: flagged ? "B" : "A",
        status: flagged ? "mismatch" : "match",
      },
    ],
  };
}

function outcome(id: string, over: Partial<BatchOutcome> = {}): BatchOutcome {
  return {
    application_id: id,
    applicant: `${id} Co.`,
    result: verified(false),
    error: null,
    pending: false,
    ...over,
  };
}

const OUTCOMES: BatchOutcome[] = [
  outcome("TTB-2024-0041"),
  outcome("TTB-2024-0044", { result: verified(true) }),
  outcome("TTB-2024-0048", { result: null, error: "Could not read" }),
];

function setup(decisions: ReadonlyMap<string, Decision> = new Map()) {
  const onOpen = vi.fn();
  render(
    <BatchResults
      outcomes={OUTCOMES}
      decisions={decisions}
      onOpen={onOpen}
      onBack={vi.fn()}
    />,
  );
  return onOpen;
}

function ids(): string[] {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => row.textContent.match(/TTB-\d{4}-\d{4}/)?.[0] ?? "");
}

describe("BatchResults as a worklist", () => {
  it("puts unreadable labels first, then flagged, then clean", () => {
    setup();
    expect(ids()).toEqual(["TTB-2024-0048", "TTB-2024-0044", "TTB-2024-0041"]);
  });

  it("shows which labels still need a decision", () => {
    setup();
    expect(screen.getAllByText("Not decided")).toHaveLength(3);
  });

  it("marks a decided label so the agent sees their progress", () => {
    setup(
      new Map([
        [
          "TTB-2024-0044",
          { status: "approved", decidedAt: "", flaggedFields: ["brand_name"] },
        ],
      ]),
    );
    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.getAllByText("Not decided")).toHaveLength(2);
  });

  it("sinks decided labels so what is left stays at the top", () => {
    setup(
      new Map([
        ["TTB-2024-0048", { status: "denied", decidedAt: "", flaggedFields: [] }],
      ]),
    );
    // 0048 would otherwise sort first as the unreadable one.
    expect(ids()).toEqual(["TTB-2024-0044", "TTB-2024-0041", "TTB-2024-0048"]);
  });

  it("says how far through the batch the agent is", () => {
    setup(
      new Map([
        ["TTB-2024-0041", { status: "approved", decidedAt: "", flaggedFields: [] }],
      ]),
    );
    expect(screen.getByText(/You have decided 1 of 3/)).toBeInTheDocument();
  });

  it("offers a decided row a way back in rather than hiding it", () => {
    setup(
      new Map([
        ["TTB-2024-0041", { status: "approved", decidedAt: "", flaggedFields: [] }],
      ]),
    );
    expect(screen.getByRole("button", { name: "Open again" })).toBeInTheDocument();
  });
});
