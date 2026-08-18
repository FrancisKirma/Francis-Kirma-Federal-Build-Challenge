/** Typed wrappers over the backend API. Every fetch in the app goes through here. */

import type { ApplicationSummary, VerificationResponse } from "../types";
import { ApiError, toApiError } from "./errors";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new ApiError("Could not reach the server. Check your connection.", 0);
  }
  if (!response.ok) {
    throw await toApiError(response);
  }
  return (await response.json()) as T;
}

export function fetchApplications(): Promise<ApplicationSummary[]> {
  return request<ApplicationSummary[]>("/api/applications");
}

export function verifyApplication(id: string): Promise<VerificationResponse> {
  return request<VerificationResponse>(`/api/verify/${id}`, { method: "POST" });
}

export function verifyUpload(
  image: File,
  claimed: Record<string, string | boolean>,
): Promise<VerificationResponse> {
  const form = new FormData();
  form.append("image", image);
  form.append("claimed", JSON.stringify(claimed));
  return request<VerificationResponse>("/api/verify/upload", {
    method: "POST",
    body: form,
  });
}

export function labelImageUrl(id: string): string {
  return `/api/labels/${id}`;
}
