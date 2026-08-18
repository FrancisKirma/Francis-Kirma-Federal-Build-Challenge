import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Queue } from "./Queue";
import type { ApplicationSummary } from "../../types";

const APPLICATIONS: ApplicationSummary[] = [
  {
    application_id: "TTB-2024-0041",
    applicant: "Old Tom Distillery LLC",
    submitted_date: "2024-03-11",
    beverage_type: "distilled_spirits",
    artwork: "labels/ttb-2024-0041.png",
    submitted: {
      brand_name: "OLD TOM DISTILLERY",
      class_type: "Kentucky Straight Bourbon Whiskey",
      alcohol_content: "45% Alc./Vol.",
      net_contents: "750 mL",
      government_warning: true,
    },
  },
  {
    application_id: "TTB-2024-0042",
    applicant: "Stone's Throw Spirits Co.",
    submitted_date: "2024-03-11",
    beverage_type: "distilled_spirits",
    artwork: "labels/ttb-2024-0042.png",
    submitted: {
      brand_name: "Stone's Throw",
      class_type: "Straight Rye Whiskey",
      alcohol_content: "43% Alc./Vol.",
      net_contents: "750 mL",
      government_warning: true,
    },
  },
];

function setup(selected = new Set<string>()) {
  const props = {
    applications: APPLICATIONS,
    selected,
    onToggle: vi.fn(),
    onToggleAll: vi.fn(),
    onReview: vi.fn(),
    onCheckSelected: vi.fn(),
  };
  render(<Queue {...props} />);
  return props;
}

describe("Queue", () => {
  it("lists every application awaiting review", () => {
    setup();
    expect(screen.getByText("TTB-2024-0041")).toBeInTheDocument();
    expect(screen.getByText("Stone's Throw Spirits Co.")).toBeInTheDocument();
  });

  it("gives every row a button rather than a bare clickable row", async () => {
    const props = setup();
    const [first] = screen.getAllByRole("button", { name: "Check this label" });
    if (first === undefined) throw new Error("no review buttons rendered");
    await userEvent.click(first);
    expect(props.onReview).toHaveBeenCalledWith("TTB-2024-0041");
  });

  it("disables the batch button until something is selected", () => {
    setup();
    expect(
      screen.getByRole("button", { name: "Check selected labels" }),
    ).toBeDisabled();
  });

  it("says how many are selected so the count is never a guess", () => {
    setup(new Set(["TTB-2024-0041"]));
    expect(
      screen.getByRole("button", { name: "Check 1 selected label" }),
    ).toBeEnabled();
  });

  it("labels every checkbox for screen readers", () => {
    setup();
    expect(
      screen.getByRole("checkbox", { name: "Select TTB-2024-0041" }),
    ).toBeInTheDocument();
  });
});
