import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppShell } from "./AppShell";

describe("AppShell", () => {
  it("gives the page exactly one h1", () => {
    render(<AppShell>content</AppShell>);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("lets a keyboard user skip the banner and header", () => {
    render(<AppShell>content</AppShell>);
    const skip = screen.getByRole("link", { name: /Skip to the applications/ });
    expect(skip).toHaveAttribute("href", "#main-content");
  });

  it("points the skip link at a target that exists", () => {
    const { container } = render(<AppShell>content</AppShell>);
    expect(container.querySelector("#main-content")).not.toBeNull();
  });

  it("says plainly that this is not a real government site", () => {
    render(<AppShell>content</AppShell>);
    expect(screen.getByText(/Demo only — not a government site/i)).toBeInTheDocument();
  });

  it("makes no official-website claim, which a prototype cannot", () => {
    const { container } = render(<AppShell>content</AppShell>);
    expect(container.querySelector(".usa-banner")).toBeNull();
    expect(screen.queryByText(/An official website/i)).not.toBeInTheDocument();
  });

  it("puts the demo marking beside the tool's name", () => {
    render(<AppShell>content</AppShell>);
    const heading = screen.getByRole("heading", { level: 1 });
    const pill = screen.getByText(/Demo only/i);
    expect(heading.parentElement?.contains(pill)).toBe(true);
  });

  it("marks the sample data as a prototype in the header", () => {
    render(<AppShell>content</AppShell>);
    expect(screen.getByText(/Prototype with sample applications/i)).toBeInTheDocument();
  });

  it("warns that the first check is slower, before anyone waits on it", () => {
    render(<AppShell>content</AppShell>);
    expect(screen.getByText(/first label you check may take a few seconds/i))
      .toBeInTheDocument();
  });

  it("puts the work in a main landmark", () => {
    render(<AppShell>content</AppShell>);
    expect(screen.getByRole("main")).toHaveTextContent("content");
  });
});
