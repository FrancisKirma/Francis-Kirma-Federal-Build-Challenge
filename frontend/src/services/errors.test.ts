import { describe, expect, it } from "vitest";

import { messageFor, toApiError, ApiError } from "./errors";

function response(status: number): Response {
  return new Response(JSON.stringify({ detail: "raw backend detail" }), { status });
}

describe("toApiError", () => {
  it("does not blame label reading when the queue could not load", async () => {
    const error = await toApiError(response(502), "queue");
    expect(error.message).toMatch(/server is not responding/i);
    expect(error.message).not.toMatch(/label/i);
  });

  it("blames label reading when a verification fails", async () => {
    const error = await toApiError(response(502), "verify");
    expect(error.message).toMatch(/label could not be read/i);
  });

  it("treats a gateway timeout like an unreachable server", async () => {
    const error = await toApiError(response(504), "queue");
    expect(error.message).toMatch(/server is not responding/i);
  });

  it("says what to do about an unsupported file rather than showing a code", async () => {
    const error = await toApiError(response(415));
    expect(error.message).toMatch(/JPEG, PNG, or WebP/);
  });

  it("never leaks a status code into the message", async () => {
    for (const status of [404, 413, 415, 500, 502]) {
      const error = await toApiError(response(status));
      expect(error.message).not.toMatch(/\d{3}/);
    }
  });
});

describe("messageFor", () => {
  it("passes through wording meant for the agent", () => {
    expect(messageFor(new ApiError("Try again in a moment.", 502))).toBe(
      "Try again in a moment.",
    );
  });

  it("does not surface an unexpected error's internals", () => {
    expect(messageFor(new TypeError("undefined is not a function"))).toBe(
      "Something went wrong. Try again.",
    );
  });
});
