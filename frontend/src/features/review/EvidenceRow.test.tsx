import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EvidenceRow } from "./EvidenceRow";
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

  it("says a check is running rather than showing an empty value", () => {
    setup(undefined, { busy: true });
    expect(screen.getByText("Reading…")).toBeInTheDocument();
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
      claimed: "GOVERNMENT WARNING: (1) According",
      extracted: "Government Warning: (1) According",
      status: "mismatch",
    });
    expect(
      screen.getByText(/Same wording, different capitalisation/),
    ).toBeInTheDocument();
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
