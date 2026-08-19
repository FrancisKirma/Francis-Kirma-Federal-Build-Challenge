import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useToast } from "./useToast";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useToast", () => {
  it("holds nothing until something is confirmed", () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toast).toBeNull();
  });

  it("shows the message it was given", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.show("TTB-2024-0041 marked approved.");
    });
    expect(result.current.toast?.message).toBe("TTB-2024-0041 marked approved.");
  });

  it("clears itself so a stale confirmation does not linger", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.show("done");
    });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.toast).toBeNull();
  });

  it("can be dismissed before it expires", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.show("done");
    });
    act(() => {
      result.current.dismiss();
    });
    expect(result.current.toast).toBeNull();
  });

  it("keeps only the latest outcome when decisions come quickly", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.show("first");
    });
    act(() => {
      result.current.show("second");
    });
    expect(result.current.toast?.message).toBe("second");
  });

  it("restarts the timer for a new message rather than expiring early", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.show("first");
    });
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    act(() => {
      result.current.show("second");
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    // The second message must still be visible; it has only been up 2s.
    expect(result.current.toast?.message).toBe("second");
  });
});
