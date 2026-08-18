import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DecisionBar } from "./DecisionBar";
import type { VerificationResponse } from "../../types";

const CLEAN: VerificationResponse = {
  application_id: "TTB-2024-0041",
  flagged: false,
  elapsed_seconds: 2,
  fields: [
    { field: "brand_name", claimed: "A", extracted: "A", status: "match" },
  ],
};

const FLAGGED: VerificationResponse = {
  application_id: "TTB-2024-0044",
  flagged: true,
  elapsed_seconds: 3,
  fields: [
    { field: "brand_name", claimed: "A", extracted: "A", status: "match" },
    {
      field: "government_warning",
      claimed: "True",
      extracted: "Government Warning:",
      status: "mismatch",
    },
  ],
};

function setup(result: VerificationResponse | null) {
  const onDecide = vi.fn();
  render(<DecisionBar result={result} existing={undefined} onDecide={onDecide} />);
  return onDecide;
}

describe("DecisionBar before a check", () => {
  it("marks the section as blocked so the reason is scannable", () => {
    setup(null);
    expect(screen.getByText("Verify first")).toBeInTheDocument();
  });

  it("locks both decisions until the evidence has been looked at", () => {
    setup(null);
    expect(screen.getByRole("button", { name: "Approve application" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reject application" })).toBeDisabled();
  });

  it("says why the buttons are locked rather than leaving them mysteriously grey", () => {
    setup(null);
    expect(screen.getByText(/Verify the label first/)).toBeInTheDocument();
  });
});

describe("DecisionBar after a check", () => {
  it("drops the blocked marker once a result exists", () => {
    setup(CLEAN);
    expect(screen.queryByText("Verify first")).not.toBeInTheDocument();
  });

  it("approves a clean label directly", async () => {
    const onDecide = setup(CLEAN);
    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(screen.getByRole("button", { name: "Approve application" }));
    expect(onDecide).toHaveBeenCalledWith("approved");
  });

  it("routes a flagged approval through a confirmation instead of deciding", () => {
    setup(FLAGGED);
    // The approve control opens the confirm dialog rather than deciding outright.
    // jsdom reports no layout, so focus-trap cannot open the modal here; the
    // dialog's own behaviour is covered by the browser pass.
    const approve = screen.getByRole("button", { name: "Approve application" });
    expect(approve).toHaveAttribute("data-open-modal");
  });

  it("names what disagrees before letting the agent override it", () => {
    setup(FLAGGED);
    expect(screen.getByText("Government warning")).toBeInTheDocument();
  });

  it("rejects without a confirmation step", async () => {
    const onDecide = setup(FLAGGED);
    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(screen.getByRole("button", { name: "Reject application" }));
    expect(onDecide).toHaveBeenCalledWith("denied");
  });
});
