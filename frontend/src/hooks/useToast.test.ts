import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useToast } from "./useToast";

const APPROVED = {
  applicationId: "TTB-2024-0041",
  applicant: "Old Tom Distillery LLC",
  status: "approved" as const,
  reason: null,
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useToast", () => {
  it("holds nothing until something is decided", () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toast).toBeNull();
  });

  it("names the application and the outcome", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.show(APPROVED);
    });
    expect(result.current.toast?.applicationId).toBe("TTB-2024-0041");
    expect(result.current.toast?.status).toBe("approved");
  });

  it("carries the recorded reason when there was one", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.show({
        ...APPROVED,
        status: "denied",
        reason: "Warning statement is not compliant",
      });
    });
    expect(result.current.toast?.reason).toBe("Warning statement is not compliant");
  });

  it("clears itself so a stale confirmation does not linger", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.show(APPROVED);
    });
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(result.current.toast).toBeNull();
  });

  it("can be dismissed before it expires", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.show(APPROVED);
    });
    act(() => {
      result.current.dismiss();
    });
    expect(result.current.toast).toBeNull();
  });

  it("replaces rather than stacks when decisions come quickly", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.show(APPROVED);
    });
    act(() => {
      result.current.show({ ...APPROVED, applicationId: "TTB-2024-0042" });
    });
    expect(result.current.toast?.applicationId).toBe("TTB-2024-0042");
  });

  it("restarts the timer for a new decision rather than expiring early", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.show(APPROVED);
    });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    act(() => {
      result.current.show({ ...APPROVED, applicationId: "TTB-2024-0042" });
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.toast?.applicationId).toBe("TTB-2024-0042");
  });
});
