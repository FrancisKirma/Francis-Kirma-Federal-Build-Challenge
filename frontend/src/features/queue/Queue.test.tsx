import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Queue } from "./Queue";
import type { QueueTab } from "./QueueTabs";
import type {
  ApplicationSummary,
  Decision,
  VerificationResponse,
} from "../../types";

function application(id: string, applicant: string): ApplicationSummary {
  return {
    application_id: id,
    applicant,
    submitted_date: "2024-03-11",
    beverage_type: "distilled_spirits",
    artwork: `labels/${id}.png`,
    submitted: {
      brand_name: "OLD TOM DISTILLERY",
      class_type: "Kentucky Straight Bourbon Whiskey",
      alcohol_content: "45% Alc./Vol.",
      net_contents: "750 mL",
      government_warning: true,
    },
  };
}

const APPLICATIONS = [
  application("TTB-2024-0041", "Old Tom Distillery LLC"),
  application("TTB-2024-0042", "Stone's Throw Spirits Co."),
];

const FLAGGED: VerificationResponse = {
  application_id: "TTB-2024-0041",
  flagged: true,
  elapsed_seconds: 2,
  fields: [
    {
      field: "alcohol_content",
      claimed: "45%",
      extracted: "43%",
      status: "mismatch",
    },
  ],
};

const CLEAN: VerificationResponse = { ...FLAGGED, flagged: false, fields: [] };

function setup(options: {
  tab?: QueueTab;
  selected?: Set<string>;
  decisions?: ReadonlyMap<string, Decision>;
  results?: Record<string, VerificationResponse>;
  busy?: string[];
} = {}) {
  const results = options.results ?? {};
  const busy = options.busy ?? [];
  const props = {
    applications: APPLICATIONS,
    decisions: options.decisions ?? new Map<string, Decision>(),
    resultFor: (id: string) => results[id] ?? null,
    isBusy: (id: string) => busy.includes(id),
    tab: options.tab ?? "pending",
    selected: options.selected ?? new Set<string>(),
    onToggle: vi.fn(),
    onToggleAll: vi.fn(),
    onReview: vi.fn(),
  };
  render(<Queue {...props} />);
  return props;
}

describe("Queue triage", () => {
  it("lists every application in the tab", () => {
    setup();
    expect(screen.getByText("TTB-2024-0041")).toBeInTheDocument();
    expect(screen.getByText("Stone's Throw Spirits Co.")).toBeInTheDocument();
  });

  it("says a label has not been checked rather than implying a verdict", () => {
    setup();
    expect(screen.getAllByText("Not checked")).toHaveLength(2);
  });

  it("names the fields that differ, so the agent can choose what to open", () => {
    setup({ results: { "TTB-2024-0041": FLAGGED } });
    expect(screen.getByText("1 needs attention")).toBeInTheDocument();
    expect(screen.getByText("Alcohol content")).toBeInTheDocument();
  });

  it("marks a clean label as needing nothing", () => {
    setup({ results: { "TTB-2024-0041": CLEAN } });
    expect(screen.getByText("Everything matches")).toBeInTheDocument();
  });

  it("shows a check in progress rather than a stale state", () => {
    setup({ busy: ["TTB-2024-0041"] });
    expect(screen.getByText("Checking…")).toBeInTheDocument();
  });

  it("offers to check on open when nothing has been read yet", () => {
    setup();
    expect(screen.getAllByRole("button", { name: "Open and check" })).toHaveLength(2);
  });

  it("just opens when a result is already held", () => {
    setup({ results: { "TTB-2024-0041": CLEAN } });
    expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument();
  });

  it("opens the application the agent chose", async () => {
    const props = setup();
    const [first] = screen.getAllByRole("button", { name: "Open and check" });
    if (first === undefined) throw new Error("no open buttons rendered");
    await userEvent.click(first);
    expect(props.onReview).toHaveBeenCalledWith("TTB-2024-0041");
  });

  it("labels every checkbox for screen readers", () => {
    setup();
    expect(
      screen.getByRole("checkbox", { name: "Select TTB-2024-0041" }),
    ).toBeInTheDocument();
  });
});

describe("Queue on a decided tab", () => {
  const decided = new Map<string, Decision>([
    [
      "TTB-2024-0041",
      {
        status: "approved",
        decidedAt: "2026-08-19T14:32:00Z",
        flaggedFields: ["alcohol_content"],
        reason: "The difference is acceptable",
        note: "",
      },
    ],
  ]);

  it("hides selection controls, which only apply to pending work", () => {
    setup({ tab: "approved", decisions: decided });
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("records what was decided, when, and why", () => {
    setup({ tab: "approved", decisions: decided });
    expect(screen.getByText(/Approved · /)).toBeInTheDocument();
    expect(screen.getByText(/The difference is acceptable/)).toBeInTheDocument();
  });

  it("says so plainly when a tab is empty", () => {
    render(
      <Queue
        applications={[]}
        decisions={new Map()}
        resultFor={() => null}
        isBusy={() => false}
        tab="denied"
        selected={new Set()}
        onToggle={vi.fn()}
        onToggleAll={vi.fn()}
        onReview={vi.fn()}
      />,
    );
    expect(
      screen.getByText("You have not rejected any applications yet."),
    ).toBeInTheDocument();
  });
});
