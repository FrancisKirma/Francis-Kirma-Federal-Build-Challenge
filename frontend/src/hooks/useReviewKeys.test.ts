import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useReviewKeys } from "./useReviewKeys";

function handlers() {
  return {
    onBack: vi.fn(),
    onApprove: vi.fn(),
    onReject: vi.fn(),
    onNext: vi.fn(),
    onPrevious: vi.fn(),
  };
}

function press(key: string, target?: EventTarget): void {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  (target ?? document).dispatchEvent(event);
}

describe("useReviewKeys", () => {
  it("decides with a single keystroke", () => {
    const h = handlers();
    renderHook(() => { useReviewKeys({ enabled: true, ...h }); });
    press("a");
    press("r");
    expect(h.onApprove).toHaveBeenCalled();
    expect(h.onReject).toHaveBeenCalled();
  });

  it("walks the lane with j and k", () => {
    const h = handlers();
    renderHook(() => { useReviewKeys({ enabled: true, ...h }); });
    press("j");
    press("k");
    expect(h.onNext).toHaveBeenCalled();
    expect(h.onPrevious).toHaveBeenCalled();
  });

  it("leaves the review on Escape", () => {
    const h = handlers();
    renderHook(() => { useReviewKeys({ enabled: true, ...h }); });
    press("Escape");
    expect(h.onBack).toHaveBeenCalled();
  });

  it("stays inert while a dialog is open", () => {
    const h = handlers();
    renderHook(() => { useReviewKeys({ enabled: false, ...h }); });
    press("a");
    expect(h.onApprove).not.toHaveBeenCalled();
  });

  it("does not decide while the agent is typing a note", () => {
    const h = handlers();
    renderHook(() => { useReviewKeys({ enabled: true, ...h }); });
    const input = document.createElement("textarea");
    document.body.appendChild(input);
    press("a", input);
    document.body.removeChild(input);
    expect(h.onApprove).not.toHaveBeenCalled();
  });

  it("ignores browser shortcuts rather than hijacking them", () => {
    const h = handlers();
    renderHook(() => { useReviewKeys({ enabled: true, ...h }); });
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "a", metaKey: true, bubbles: true }),
    );
    expect(h.onApprove).not.toHaveBeenCalled();
  });

  it("accepts the shortcuts in upper case too", () => {
    const h = handlers();
    renderHook(() => { useReviewKeys({ enabled: true, ...h }); });
    press("A");
    expect(h.onApprove).toHaveBeenCalled();
  });
});
