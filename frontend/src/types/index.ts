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

export type DecisionStatus = "approved" | "denied";

/**
 * An agent's determination on one application.
 *
 * ``flaggedFields`` records what disagreed at the moment of the decision, so
 * "approved while the warning did not match" stays distinguishable from
 * "approved clean". That distinction is the whole value of recording anything.
 */
export interface Decision {
  status: DecisionStatus;
  decidedAt: string;
  flaggedFields: string[];
  /**
   * Why the agent decided this, when the decision needed one: a rejection, or
   * an approval over something that did not match. Null for a clean approval,
   * which needs no justification beyond the evidence.
   */
  reason: string | null;
  note: string;
}

/** The reasons offered for each kind of decision that requires one. */
export const DECISION_REASONS: Record<DecisionStatus, string[]> = {
  approved: [
    "The difference is acceptable",
    "The form data was corrected after filing",
    "Reading is wrong; the label is compliant",
  ],
  denied: [
    "Values on the label do not match the form",
    "Warning statement is not compliant",
    "Artwork cannot be read; resubmission needed",
  ],
};

/** The order the backend returns fields in, and the order they read best in. */
export const FIELD_ORDER = [
  "brand_name",
  "class_type",
  "alcohol_content",
  "net_contents",
  "government_warning",
] as const;

/** Plain-language labels; the API's field names are not shown to the agent. */
export const FIELD_LABELS: Record<string, string> = {
  brand_name: "Brand name",
  class_type: "Class or type",
  alcohol_content: "Alcohol content",
  net_contents: "Net contents",
  government_warning: "Government warning",
};
