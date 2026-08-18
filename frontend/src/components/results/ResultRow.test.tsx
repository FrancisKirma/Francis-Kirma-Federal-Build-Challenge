import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ResultRow } from "./ResultRow";
import type { FieldResult } from "../../types";

function row(overrides: Partial<FieldResult> = {}): FieldResult {
  return {
    field: "brand_name",
    claimed: "OLD TOM DISTILLERY",
    extracted: "OLD TOM DISTILLERY",
    status: "match",
    ...overrides,
  };
}

function renderRow(result: FieldResult): void {
  render(
    <table>
      <tbody>
        <ResultRow result={result} />
      </tbody>
    </table>,
  );
}

describe("ResultRow", () => {
  it("states the status in words, not only colour", () => {
    renderRow(row({ status: "mismatch" }));
    expect(screen.getByText("Does not match")).toBeInTheDocument();
  });

  it("says a field could not be read rather than showing an empty cell", () => {
    renderRow(row({ extracted: null, status: "unreadable" }));
    expect(screen.getByText("Not found on the label")).toBeInTheDocument();
  });

  it("shows both values so the agent can judge for themselves", () => {
    renderRow(row({ claimed: "750 mL", extracted: "700 mL", status: "mismatch" }));
    expect(screen.getByText("750 mL")).toBeInTheDocument();
    expect(screen.getByText("700 mL")).toBeInTheDocument();
  });

  it("renders the warning attestation as plain words, not True/False", () => {
    renderRow(
      row({ field: "government_warning", claimed: "True", status: "unreadable" }),
    );
    expect(screen.getByText("Stated as present")).toBeInTheDocument();
    expect(screen.queryByText("True")).not.toBeInTheDocument();
  });

  it("uses a plain-language label instead of the API field name", () => {
    renderRow(row({ field: "net_contents" }));
    expect(screen.getByText("Net contents")).toBeInTheDocument();
    expect(screen.queryByText("net_contents")).not.toBeInTheDocument();
  });
});
