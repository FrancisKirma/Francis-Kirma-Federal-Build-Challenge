import { Button, ButtonGroup } from "@trussworks/react-uswds";

import type { Decision, VerificationResponse } from "../../types";

interface DecisionBarProps {
  /** Null until the agent has run a check; the decision buttons stay locked. */
  result: VerificationResponse | null;
  existing: Decision | undefined;
  onDecide: (status: "approved" | "denied") => void;
}

/**
 * Approve and reject, available only once a check has produced a result.
 *
 * A tool that is easy to rubber-stamp is worse than no tool: it launders a
 * skipped check into a recorded approval. Whether a decision needs a recorded
 * reason is decided upstream, so this stays a pair of buttons.
 */
export function DecisionBar({
  result,
  existing,
  onDecide,
}: DecisionBarProps): React.ReactElement {
  const hint =
    result === null
      ? "Verify the label first. A decision should follow a look at the evidence."
      : result.flagged
        ? "Approving this needs a recorded reason, because something does not match."
        : "Approving or rejecting is your determination, not the tool's.";

  return (
    <div className="padding-2 bg-base-lightest radius-md">
      {existing !== undefined && (
        <p className="font-body-3xs text-base-dark margin-top-0">
          You marked this application{" "}
          <strong>{existing.status === "approved" ? "approved" : "rejected"}</strong>
          {existing.reason !== null && ` — ${existing.reason}`}. Choosing again
          replaces that.
        </p>
      )}

      <h3 className="font-heading-md margin-top-0 margin-bottom-1">Your decision</h3>
      <p className="font-body-sm text-base-dark margin-top-0 margin-bottom-1">{hint}</p>

      <ButtonGroup>
        <Button
          type="button"
          disabled={result === null}
          onClick={() => {
            onDecide("approved");
          }}
        >
          Approve application
        </Button>
        <Button
          type="button"
          secondary
          disabled={result === null}
          onClick={() => {
            onDecide("denied");
          }}
        >
          Reject application
        </Button>
      </ButtonGroup>
    </div>
  );
}
