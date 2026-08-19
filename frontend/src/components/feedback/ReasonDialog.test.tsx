import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ReasonDialog } from "./ReasonDialog";
import type { DecisionStatus } from "../../types";

function setup(mode: DecisionStatus | null, flagged: string[] = ["alcohol_content"]) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ReasonDialog
      mode={mode}
      flaggedFields={flagged}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  );
  return { onConfirm, onCancel };
}

describe("ReasonDialog", () => {
  it("stays closed when no decision is awaiting a reason", () => {
    setup(null);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("names what disagreed before letting an approval override it", () => {
    setup("approved");
    expect(screen.getByText(/does not match the form on: Alcohol content/)).toBeInTheDocument();
  });

  it("will not record a decision until a reason is chosen", () => {
    setup("denied");
    expect(screen.getByRole("button", { name: "Reject application" })).toBeDisabled();
  });

  it("passes the chosen reason back with the decision", async () => {
    const { onConfirm } = setup("denied");
    await userEvent.click(
      screen.getByLabelText("Warning statement is not compliant"),
    );
    await userEvent.click(screen.getByRole("button", { name: "Reject application" }));
    expect(onConfirm).toHaveBeenCalledWith("Warning statement is not compliant", "");
  });

  it("carries an optional note alongside the reason", async () => {
    const { onConfirm } = setup("approved");
    await userEvent.click(screen.getByLabelText("The difference is acceptable"));
    await userEvent.type(screen.getByLabelText("Note (optional)"), "Checked with Dave");
    await userEvent.click(screen.getByRole("button", { name: "Yes, approve it" }));
    expect(onConfirm).toHaveBeenCalledWith(
      "The difference is acceptable",
      "Checked with Dave",
    );
  });

  it("offers different reasons for approving and rejecting", () => {
    const { unmount } = render(
      <ReasonDialog
        mode="approved"
        flaggedFields={[]}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("The difference is acceptable")).toBeInTheDocument();
    unmount();

    setup("denied");
    expect(
      screen.getByLabelText("Values on the label do not match the form"),
    ).toBeInTheDocument();
  });

  it("can be abandoned without recording anything", async () => {
    const { onCancel, onConfirm } = setup("denied");
    await userEvent.click(screen.getByRole("button", { name: "Go back" }));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("closes on Escape, like every other dialog", async () => {
    const { onCancel } = setup("denied");
    await userEvent.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalled();
  });
});
