import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EvidenceRow } from "./EvidenceRow";
import { STATUTORY_WARNING } from "../../constants";
import type { FieldResult } from "../../types";

function setup(result: FieldResult | undefined, opts: { busy?: boolean; focused?: boolean } = {}) {
  const onFocus = vi.fn();
  render(
    <EvidenceRow
      field={result?.field ?? "alcohol_content"}
      claimed="45% Alc./Vol. (90 Proof)"
      result={result}
      busy={opts.busy ?? false}
      focused={opts.focused ?? false}
      onFocus={onFocus}
    />,
  );
  return onFocus;
}

const MISMATCH: FieldResult = {
  field: "alcohol_content",
  claimed: "45% Alc./Vol. (90 Proof)",
  extracted: "43% Alc./Vol. (86 Proof)",
  status: "mismatch",
};

describe("EvidenceRow", () => {
  it("shows what the form says even before a check", () => {
    setup(undefined);
    expect(screen.getByText("45% Alc./Vol. (90 Proof)")).toBeInTheDocument();
    expect(screen.getByText("Not checked yet")).toBeInTheDocument();
  });

  it("shows a placeholder where the answer will appear while it is read", () => {
    setup(undefined, { busy: true });
    // The row keeps its shape, so nothing jumps when the value arrives.
    expect(screen.getByLabelText("Reading the label")).toBeInTheDocument();
    expect(screen.queryByText("Not checked yet")).not.toBeInTheDocument();
  });

  it("keeps the form value visible while the label is being read", () => {
    setup(undefined, { busy: true });
    expect(screen.getByText("45% Alc./Vol. (90 Proof)")).toBeInTheDocument();
  });

  it("states the status in words, not colour alone", () => {
    setup(MISMATCH);
    expect(screen.getByText("Does not match")).toBeInTheDocument();
  });

  it("explains a numeric disagreement in the values themselves", () => {
    setup(MISMATCH);
    expect(
      screen.getByText(/Form says 45% Alc\.\/Vol\. \(90 Proof\); the label reads 43%/),
    ).toBeInTheDocument();
  });

  it("explains a casing-only warning difference as exactly that", () => {
    setup({
      field: "government_warning",
      claimed: STATUTORY_WARNING,
      // Title case: the wording is right, the capitalisation is not.
      extracted: STATUTORY_WARNING.replace(
        "GOVERNMENT WARNING:",
        "Government Warning:",
      ).replace("According to the Surgeon General", "According To The Surgeon General"),
      status: "mismatch",
    });
    expect(
      screen.getByText(/different capitalisation.*compared exactly/),
    ).toBeInTheDocument();
  });

  it("says a wrong-wording warning is not the required statement", () => {
    setup({
      field: "government_warning",
      claimed: STATUTORY_WARNING,
      extracted: "Drink responsibly.",
      status: "mismatch",
    });
    expect(screen.getByText(/not the required statement/)).toBeInTheDocument();
  });

  it("labels the warning's left value as what is required, not what was claimed", () => {
    setup({
      field: "government_warning",
      claimed: STATUTORY_WARNING,
      extracted: STATUTORY_WARNING,
      status: "match",
    });
    expect(screen.getByText("Required")).toBeInTheDocument();
    expect(screen.queryByText("Form")).not.toBeInTheDocument();
  });

  it("says where an unreadable field should have been", () => {
    setup({
      field: "government_warning",
      claimed: "Stated as present",
      extracted: null,
      status: "unreadable",
    });
    expect(
      screen.getByText(/Nothing found where this field belongs/),
    ).toBeInTheDocument();
    expect(screen.getByText("Not found on the label")).toBeInTheDocument();
  });

  it("adds no explanation to a field that matches", () => {
    setup({ ...MISMATCH, extracted: MISMATCH.claimed, status: "match" });
    expect(screen.queryByText(/Form says/)).not.toBeInTheDocument();
  });

  it("selects the field so the artwork can zoom to it", async () => {
    const onFocus = setup(MISMATCH);
    await userEvent.click(screen.getByRole("button"));
    expect(onFocus).toHaveBeenCalled();
  });

  it("announces which row is currently selected", () => {
    setup(MISMATCH, { focused: true });
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });
});
