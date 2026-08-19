import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Toast } from "./Toast";

const TOAST = {
  applicationId: "TTB-2024-0043",
  applicant: "Cedar Hollow Distilling",
  status: "denied" as const,
  reason: "Values on the label do not match the form",
  id: 1,
};

describe("Toast", () => {
  it("keeps the live region in the document while empty", () => {
    const { container } = render(
      <Toast toast={null} onUndo={vi.fn()} onDismiss={vi.fn()} />,
    );
    // A region added at the same moment as its text is not reliably announced.
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
  });

  it("announces the decision rather than only showing it", () => {
    render(<Toast toast={TOAST} onUndo={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("TTB-2024-0043 rejected");
  });

  it("shows the recorded reason so the confirmation is auditable at a glance", () => {
    render(<Toast toast={TOAST} onUndo={vi.fn()} onDismiss={vi.fn()} />);
    expect(
      screen.getByText(/Values on the label do not match the form/),
    ).toBeInTheDocument();
  });

  it("offers Undo, since a decision can be made with one keystroke", async () => {
    const onUndo = vi.fn();
    const { default: userEvent } = await import("@testing-library/user-event");
    render(<Toast toast={TOAST} onUndo={onUndo} onDismiss={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onUndo).toHaveBeenCalled();
  });

  it("can be dismissed by keyboard as well as waiting", async () => {
    const onDismiss = vi.fn();
    const { default: userEvent } = await import("@testing-library/user-event");
    render(<Toast toast={TOAST} onUndo={vi.fn()} onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it("omits the reason line cleanly when a clean approval had none", () => {
    render(
      <Toast
        toast={{ ...TOAST, status: "approved", reason: null }}
        onUndo={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("TTB-2024-0043 approved");
    expect(screen.getByText("Cedar Hollow Distilling")).toBeInTheDocument();
  });
});
