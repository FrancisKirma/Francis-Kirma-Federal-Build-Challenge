import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useVerification } from "./useVerification";
import * as api from "../services/api";
import type { VerificationResponse } from "../types";

function response(id: string): VerificationResponse {
  return {
    application_id: id,
    flagged: false,
    elapsed_seconds: 2,
    fields: [{ field: "brand_name", claimed: "A", extracted: "A", status: "match" }],
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useVerification", () => {
  it("holds nothing before a check has run", () => {
    const { result: hook } = renderHook(() => useVerification());
    expect(hook.current.resultFor("TTB-2024-0041")).toBeNull();
    expect(hook.current.isBusy("TTB-2024-0041")).toBe(false);
  });

  it("keeps each application's result separate", async () => {
    vi.spyOn(api, "verifyApplication").mockImplementation((id: string) =>
      Promise.resolve(response(id)),
    );
    const { result: hook } = renderHook(() => useVerification());

    act(() => {
      hook.current.verify("TTB-2024-0041");
      hook.current.verify("TTB-2024-0042");
    });

    await waitFor(() => {
      expect(hook.current.resultFor("TTB-2024-0041")?.application_id).toBe(
        "TTB-2024-0041",
      );
    });
    expect(hook.current.resultFor("TTB-2024-0042")?.application_id).toBe(
      "TTB-2024-0042",
    );
  });

  it("keeps a result after the agent leaves and returns", async () => {
    const verify = vi
      .spyOn(api, "verifyApplication")
      .mockResolvedValue(response("TTB-2024-0041"));
    const { result: hook } = renderHook(() => useVerification());

    act(() => {
      hook.current.verify("TTB-2024-0041");
    });
    await waitFor(() => {
      expect(hook.current.resultFor("TTB-2024-0041")).not.toBeNull();
    });

    // Reopening must not spend another vision-model call on the same label.
    expect(hook.current.resultFor("TTB-2024-0041")).not.toBeNull();
    expect(verify).toHaveBeenCalledTimes(1);
  });

  it("accepts a result obtained elsewhere, such as a batch run", () => {
    const { result: hook } = renderHook(() => useVerification());
    act(() => {
      hook.current.remember("TTB-2024-0044", response("TTB-2024-0044"));
    });
    expect(hook.current.resultFor("TTB-2024-0044")?.application_id).toBe(
      "TTB-2024-0044",
    );
  });

  it("marks only the application being checked as busy", () => {
    vi.spyOn(api, "verifyApplication").mockReturnValue(new Promise(() => undefined));
    const { result: hook } = renderHook(() => useVerification());

    act(() => {
      hook.current.verify("TTB-2024-0041");
    });

    expect(hook.current.isBusy("TTB-2024-0041")).toBe(true);
    expect(hook.current.isBusy("TTB-2024-0042")).toBe(false);
  });

  it("records a failure against the application it belongs to", async () => {
    vi.spyOn(api, "verifyApplication").mockRejectedValue(new Error("boom"));
    const { result: hook } = renderHook(() => useVerification());

    act(() => {
      hook.current.verify("TTB-2024-0041");
    });

    await waitFor(() => {
      expect(hook.current.errorFor("TTB-2024-0041")).not.toBeNull();
    });
    expect(hook.current.errorFor("TTB-2024-0042")).toBeNull();
  });

  it("forgets one application's reading without touching the others", async () => {
    vi.spyOn(api, "verifyApplication").mockImplementation((id: string) =>
      Promise.resolve(response(id)),
    );
    const { result: hook } = renderHook(() => useVerification());

    act(() => {
      hook.current.verify("TTB-2024-0041");
      hook.current.verify("TTB-2024-0042");
    });
    await waitFor(() => {
      expect(hook.current.resultFor("TTB-2024-0042")).not.toBeNull();
    });

    act(() => {
      hook.current.forget("TTB-2024-0041");
    });

    // Undoing a decision returns that application to untouched, and only that
    // one: the rest of the agent's work stays where it was.
    expect(hook.current.resultFor("TTB-2024-0041")).toBeNull();
    expect(hook.current.resultFor("TTB-2024-0042")).not.toBeNull();
  });

  it("forgets every reading when the session is cleared", async () => {
    vi.spyOn(api, "verifyApplication").mockResolvedValue(response("TTB-2024-0041"));
    const { result: hook } = renderHook(() => useVerification());

    act(() => {
      hook.current.verify("TTB-2024-0041");
    });
    await waitFor(() => {
      expect(hook.current.resultFor("TTB-2024-0041")).not.toBeNull();
    });

    act(() => {
      hook.current.clear();
    });
    // Leaving readings behind would show every label still checked after a
    // clear, which reads as a half-finished reset.
    expect(hook.current.resultFor("TTB-2024-0041")).toBeNull();
    expect(hook.current.isBusy("TTB-2024-0041")).toBe(false);
  });

  it("counts a check even when no decision follows it", async () => {
    // The clear control keys off this count. If checks did not raise it, a
    // batch run with nothing decided would leave the queue marked up and
    // offer no way back to a clean slate.
    vi.spyOn(api, "verifyApplication").mockResolvedValue(
      response("TTB-2024-0041"),
    );
    const { result: hook } = renderHook(() => useVerification());

    expect(hook.current.checkedCount).toBe(0);

    act(() => {
      hook.current.verify("TTB-2024-0041");
    });
    await waitFor(() => {
      expect(hook.current.checkedCount).toBe(1);
    });

    act(() => {
      hook.current.clear();
    });
    expect(hook.current.checkedCount).toBe(0);
  });

  it("keeps the ad-hoc upload apart from any application", async () => {
    vi.spyOn(api, "verifyUpload").mockResolvedValue(response("upload"));
    const { result: hook } = renderHook(() => useVerification());

    act(() => {
      hook.current.upload(new File(["x"], "label.png"), {});
    });

    await waitFor(() => {
      expect(hook.current.resultFor(hook.current.uploadKey)).not.toBeNull();
    });
    expect(hook.current.resultFor("TTB-2024-0041")).toBeNull();
  });
});
