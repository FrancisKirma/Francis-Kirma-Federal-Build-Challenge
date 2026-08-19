import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatStrip } from "./StatStrip";

describe("StatStrip", () => {
  it("shows the shape of the work at a glance", () => {
    render(<StatStrip pending={8} checked={3} total={8} flagged={2} decided={0} />);
    expect(screen.getByText("In the queue")).toBeInTheDocument();
    expect(screen.getByText("3/8")).toBeInTheDocument();
  });

  it("marks the one number that changes what to do next", () => {
    const { container } = render(
      <StatStrip pending={8} checked={8} total={8} flagged={5} decided={0} />,
    );
    const alarm = container.querySelector('[class*="alarm"]');
    expect(alarm?.textContent).toBe("5");
  });

  it("leaves the count unmarked when nothing needs attention", () => {
    const { container } = render(
      <StatStrip pending={8} checked={8} total={8} flagged={0} decided={0} />,
    );
    expect(container.querySelector('[class*="alarm"]')).toBeNull();
  });
});
