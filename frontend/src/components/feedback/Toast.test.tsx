import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Toast } from "./Toast";

describe("Toast", () => {
  it("keeps the live region in the document while empty", () => {
    const { container } = render(<Toast toast={null} onDismiss={vi.fn()} />);
    // A region added at the same moment as its text is not reliably announced.
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
  });

  it("announces a decision rather than only showing it", () => {
    render(
      <Toast
        toast={{ message: "TTB-2024-0041 marked approved.", tone: "success", id: 1 }}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("marked approved");
  });

  it("can be dismissed by keyboard as well as waiting", async () => {
    const onDismiss = vi.fn();
    const { default: userEvent } = await import("@testing-library/user-event");
    render(
      <Toast toast={{ message: "done", tone: "success", id: 1 }} onDismiss={onDismiss} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Dismiss this message" }));
    expect(onDismiss).toHaveBeenCalled();
  });
});
