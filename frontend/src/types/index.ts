/** Mirrors the backend Pydantic models in backend/models/. */

export type Status = "match" | "mismatch" | "unreadable";

export interface ClaimedFields {
  brand_name: string;
  class_type: string;
  alcohol_content: string;
  net_contents: string;
  government_warning: boolean;
}

export interface ApplicationSummary {
  application_id: string;
  applicant: string;
  submitted_date: string;
  beverage_type: string;
  artwork: string;
  submitted: ClaimedFields;
}

export interface FieldResult {
  field: string;
  claimed: string;
  /** Null when the model declined to read the field, never a guess. */
  extracted: string | null;
  status: Status;
}

export interface VerificationResponse {
  application_id: string | null;
  fields: FieldResult[];
  flagged: boolean;
  elapsed_seconds: number;
}

/** One row of a batch run: either a result or the reason it could not be read. */
export interface BatchOutcome {
  application_id: string;
  applicant: string;
  result: VerificationResponse | null;
  error: string | null;
  pending: boolean;
}

/** Plain-language labels; the API's field names are not shown to the agent. */
export const FIELD_LABELS: Record<string, string> = {
  brand_name: "Brand name",
  class_type: "Class or type",
  alcohol_content: "Alcohol content",
  net_contents: "Net contents",
  government_warning: "Government warning",
};
