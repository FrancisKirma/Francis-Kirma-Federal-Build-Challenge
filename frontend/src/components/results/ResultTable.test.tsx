import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ResultTable } from "./ResultTable";
import type { ClaimedFields, FieldResult } from "../../types";

const CLAIMED: ClaimedFields = {
  brand_name: "HARBOR LIGHT",
  class_type: "Blended Whiskey",
  alcohol_content: "40% Alc./Vol. (80 Proof)",
  net_contents: "750 mL",
  government_warning: true,
};

const WARNING =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not " +
  "drink alcoholic beverages during pregnancy because of the risk of birth " +
  "defects. (2) Consumption of alcoholic beverages impairs your ability to " +
  "drive a car or operate machinery, and may cause health problems.";

const FIELDS: FieldResult[] = [
  {
    field: "brand_name",
    claimed: "HARBOR LIGHT",
    extracted: "HARBOR LIGHT",
    status: "match",
  },
  {
    field: "net_contents",
    claimed: "750 mL",
    extracted: "700 mL",
    status: "mismatch",
  },
  {
    field: "government_warning",
    claimed: "True",
    extracted: null,
    status: "unreadable",
  },
];

function renderTable(fields: FieldResult[] | null, busy = false) {
  return render(
    <ResultTable
      claimed={CLAIMED}
      fields={fields}
      busy={busy}
      claimedHeading="On the form"
      caption="Comparison"
    />,
  );
}

describe("ResultTable before a check has run", () => {
  it("shows what the form claims so the agent knows what will be checked", () => {
    renderTable(null);
    expect(screen.getByText("HARBOR LIGHT")).toBeInTheDocument();
    expect(screen.getByText("750 mL")).toBeInTheDocument();
  });

  it("lists every field that will be checked, not a shorter table", () => {
    renderTable(null);
    expect(screen.getAllByRole("row")).toHaveLength(6); // header + five fields
  });

  it("leaves the label and result columns empty rather than implying a verdict", () => {
    renderTable(null);
    expect(screen.getAllByLabelText("Not checked yet")).toHaveLength(10);
    expect(screen.queryByText("Match")).not.toBeInTheDocument();
    expect(screen.queryByText("Does not match")).not.toBeInTheDocument();
  });

  it("renders the warning attestation as words, not True or False", () => {
    renderTable(null);
    expect(screen.getByText("Stated as present")).toBeInTheDocument();
    expect(screen.queryByText("True")).not.toBeInTheDocument();
  });
});

describe("ResultTable after a check", () => {
  it("fills in what was read off the label", () => {
    renderTable(FIELDS);
    expect(screen.getByText("700 mL")).toBeInTheDocument();
  });

  it("states each status in words, not colour alone", () => {
    renderTable(FIELDS);
    expect(screen.getByText("Match")).toBeInTheDocument();
    expect(screen.getByText("Does not match")).toBeInTheDocument();
    expect(screen.getByText("Could not read")).toBeInTheDocument();
  });

  it("says a field was not found rather than leaving the cell blank", () => {
    renderTable(FIELDS);
    expect(screen.getByText("Not found on the label")).toBeInTheDocument();
  });

  it("keeps unchecked fields visibly unchecked in a partial result", () => {
    renderTable(FIELDS);
    // class_type and alcohol_content were not in FIELDS.
    expect(screen.getAllByLabelText("Not checked yet")).toHaveLength(4);
  });

  it("shows both values side by side so the agent can judge", () => {
    renderTable(FIELDS);
    const row = screen.getByRole("row", { name: /Net contents/ });
    expect(within(row).getByText("750 mL")).toBeInTheDocument();
    expect(within(row).getByText("700 mL")).toBeInTheDocument();
  });
});


describe("ResultTable with a long value", () => {
  const LONG: FieldResult[] = [
    {
      field: "government_warning",
      claimed: "True",
      extracted: WARNING,
      status: "match",
    },
  ];

  it("collapses a long value so one row cannot dominate the table", () => {
    renderTable(LONG);
    expect(screen.getByRole("group")).not.toHaveAttribute("open");
  });

  it("still shows enough to recognise the row while collapsed", () => {
    renderTable(LONG);
    const summary = screen.getByRole("group").querySelector("summary");
    expect(summary?.textContent).toContain("GOVERNMENT WARNING: (1) According");
    // Truncated, not the whole statement.
    expect(summary?.textContent).not.toContain("health problems.");
  });

  it("keeps the full value in the document for search and screen readers", () => {
    renderTable(LONG);
    expect(screen.getByText(WARNING)).toBeInTheDocument();
  });

  it("expands on click without any state of our own", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    renderTable(LONG);
    const summary = screen.getByRole("group").querySelector("summary");
    if (summary === null) throw new Error("expected a summary to click");
    await userEvent.click(summary);
    expect(screen.getByRole("group")).toHaveAttribute("open");
  });

  it("names what will expand rather than saying only Show all", () => {
    renderTable(LONG);
    expect(
      screen.getByLabelText(/Show the full government warning read from the label/),
    ).toBeInTheDocument();
  });

  it("leaves short values as plain text with nothing to expand", () => {
    renderTable(FIELDS);
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });
});


describe("ResultTable while a check is running", () => {
  it("says each empty cell is being read, not that it is unchecked", () => {
    renderTable(null, true);
    expect(screen.getAllByLabelText("Reading the label")).toHaveLength(10);
    expect(screen.queryByLabelText("Not checked yet")).not.toBeInTheDocument();
  });

  it("keeps the form values visible so the row stays identifiable", () => {
    renderTable(null, true);
    expect(screen.getByText("HARBOR LIGHT")).toBeInTheDocument();
  });

  it("goes back to unchecked when nothing is running", () => {
    renderTable(null, false);
    expect(screen.getAllByLabelText("Not checked yet")).toHaveLength(10);
    expect(screen.queryByLabelText("Reading the label")).not.toBeInTheDocument();
  });
});
