import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DecisionBar } from "./DecisionBar";
import type { Decision, VerificationResponse } from "../../types";

const CLEAN: VerificationResponse = {
  application_id: "TTB-2024-0041",
  flagged: false,
  elapsed_seconds: 2,
  fields: [{ field: "brand_name", claimed: "A", extracted: "A", status: "match" }],
};

const FLAGGED: VerificationResponse = {
  ...CLEAN,
  application_id: "TTB-2024-0043",
  flagged: true,
  fields: [
    {
      field: "alcohol_content",
      claimed: "45%",
      extracted: "43%",
      status: "mismatch",
    },
  ],
};

function setup(result: VerificationResponse | null, existing?: Decision) {
  const onDecide = vi.fn();
  render(<DecisionBar result={result} existing={existing} onDecide={onDecide} />);
  return onDecide;
}

describe("DecisionBar before a check", () => {
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
  it("warns that approving a flagged label will need a reason", () => {
    setup(FLAGGED);
    expect(screen.getByText(/needs a recorded reason/)).toBeInTheDocument();
  });

  it("says the determination is the agent's when nothing disagrees", () => {
    setup(CLEAN);
    expect(screen.getByText(/your determination, not the tool's/)).toBeInTheDocument();
  });

  it("reports the decision, leaving the reason prompt upstream", async () => {
    const onDecide = setup(FLAGGED);
    await userEvent.click(screen.getByRole("button", { name: "Approve application" }));
    expect(onDecide).toHaveBeenCalledWith("approved");
  });

  it("reports a rejection the same way", async () => {
    const onDecide = setup(FLAGGED);
    await userEvent.click(screen.getByRole("button", { name: "Reject application" }));
    expect(onDecide).toHaveBeenCalledWith("denied");
  });

  it("shows the recorded reason when a decision is being revisited", () => {
    setup(FLAGGED, {
      status: "denied",
      decidedAt: "2026-08-19T14:32:00Z",
      flaggedFields: ["alcohol_content"],
      reason: "Values on the label do not match the form",
      note: "",
    });
    expect(
      screen.getByText(/Values on the label do not match the form/),
    ).toBeInTheDocument();
  });
});
