import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useDecisions } from "./useDecisions";
import type { VerificationResponse } from "../types";

function result(overrides: Partial<VerificationResponse> = {}): VerificationResponse {
  return {
    application_id: "TTB-2024-0041",
    flagged: false,
    elapsed_seconds: 2,
    fields: [
      { field: "brand_name", claimed: "A", extracted: "A", status: "match" },
      { field: "class_type", claimed: "B", extracted: "B", status: "match" },
    ],
    ...overrides,
  };
}

const FLAGGED = result({
  flagged: true,
  fields: [
    { field: "brand_name", claimed: "A", extracted: "A", status: "match" },
    {
      field: "government_warning",
      claimed: "True",
      extracted: "Government Warning:",
      status: "mismatch",
    },
    { field: "net_contents", claimed: "750 mL", extracted: null, status: "unreadable" },
  ],
});

describe("useDecisions", () => {
  it("starts with everything pending", () => {
    const { result: hook } = renderHook(() => useDecisions(8));
    expect(hook.current.counts).toEqual({ pending: 8, approved: 0, denied: 0 });
  });

  it("moves an application out of pending when decided", () => {
    const { result: hook } = renderHook(() => useDecisions(8));
    act(() => {
      hook.current.decide("TTB-2024-0041", "approved", result());
    });
    expect(hook.current.counts).toEqual({ pending: 7, approved: 1, denied: 0 });
  });

  it("records which fields disagreed at the moment of the decision", () => {
    const { result: hook } = renderHook(() => useDecisions(8));
    act(() => {
      hook.current.decide("TTB-2024-0044", "approved", FLAGGED);
    });
    expect(hook.current.decisions.get("TTB-2024-0044")?.flaggedFields).toEqual([
      "government_warning",
      "net_contents",
    ]);
  });

  it("distinguishes an approval over problems from a clean approval", () => {
    const { result: hook } = renderHook(() => useDecisions(8));
    act(() => {
      hook.current.decide("clean", "approved", result());
      hook.current.decide("messy", "approved", FLAGGED);
    });
    expect(hook.current.decisions.get("clean")?.flaggedFields).toHaveLength(0);
    expect(hook.current.decisions.get("messy")?.flaggedFields).toHaveLength(2);
  });

  it("lets a decision be changed rather than stranding a misclick", () => {
    const { result: hook } = renderHook(() => useDecisions(8));
    act(() => {
      hook.current.decide("TTB-2024-0041", "approved", result());
    });
    act(() => {
      hook.current.decide("TTB-2024-0041", "denied", result());
    });
    expect(hook.current.counts).toEqual({ pending: 7, approved: 0, denied: 1 });
  });

  it("clears everything on reset", () => {
    const { result: hook } = renderHook(() => useDecisions(8));
    act(() => {
      hook.current.decide("TTB-2024-0041", "approved", result());
      hook.current.decide("TTB-2024-0042", "denied", result());
    });
    act(() => {
      hook.current.reset();
    });
    expect(hook.current.counts).toEqual({ pending: 8, approved: 0, denied: 0 });
    expect(hook.current.decisions.size).toBe(0);
  });
});
