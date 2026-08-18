/** Failures the agent can act on, in words rather than status codes. */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Map a failed response to wording that says what to do next. An agent who
 * cannot act on an error message is stuck, so no status codes reach the screen.
 */
export async function toApiError(response: Response): Promise<ApiError> {
  let detail = "";
  try {
    const body: unknown = await response.json();
    if (body !== null && typeof body === "object" && "detail" in body) {
      detail = String(body.detail);
    }
  } catch {
    detail = "";
  }

  switch (response.status) {
    case 404:
      return new ApiError("That application could not be found.", 404);
    case 502:
      return new ApiError(
        "The label could not be read this time. Try checking it again.",
        502,
      );
    case 413:
      return new ApiError("That image is too large. The limit is 20 MB.", 413);
    case 415:
      return new ApiError("Upload a JPEG, PNG, or WebP image.", 415);
    default:
      return new ApiError(detail || "Something went wrong. Try again.", response.status);
  }
}

/** Any thrown value, reduced to something worth showing an agent. */
export function messageFor(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Something went wrong. Try again.";
}
