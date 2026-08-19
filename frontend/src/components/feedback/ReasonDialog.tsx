import { useEffect, useState } from "react";
import { Button, ButtonGroup, Fieldset, Label, Radio, Textarea } from "@trussworks/react-uswds";

import { DECISION_REASONS, FIELD_LABELS, type DecisionStatus } from "../../types";
import styles from "./reasonDialog.module.scss";

interface ReasonDialogProps {
  /** Which decision is being justified; null when the dialog is closed. */
  mode: DecisionStatus | null;
  flaggedFields: string[];
  onConfirm: (reason: string, note: string) => void;
  onCancel: () => void;
}

/**
 * Captures why a decision was made, when the decision needs justifying.
 *
 * A rejection always needs one, and so does approving something that did not
 * match: those are the two cases where a later reader cannot infer the
 * reasoning from the evidence alone. A clean approval never opens this.
 */
export function ReasonDialog({
  mode,
  flaggedFields,
  onConfirm,
  onCancel,
}: ReasonDialogProps): React.ReactElement | null {
  const [choice, setChoice] = useState<string | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (mode === null) return undefined;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [mode, onCancel]);

  if (mode === null) return null;

  const approving = mode === "approved";
  const problems = flaggedFields
    .map((field) => FIELD_LABELS[field] ?? field)
    .join(", ");

  return (
    <div className={styles.overlay} role="presentation" onClick={onCancel}>
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reason-heading"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <h2 id="reason-heading" className="font-heading-md margin-top-0">
          {approving
            ? "Approve even though something does not match?"
            : "Record why you are rejecting this"}
        </h2>
        <p className="font-body-sm text-base-dark">
          {approving
            ? `This label does not match the form on: ${problems}. The reason is kept with the decision.`
            : "The reason is kept with the decision, so a later reader knows what was wrong."}
        </p>

        <Fieldset legend="Reason recorded with your decision" legendStyle="srOnly">
          {DECISION_REASONS[mode].map((reason, index) => (
            <Radio
              key={reason}
              id={`reason-${String(index)}`}
              name="decision-reason"
              label={reason}
              checked={choice === reason}
              onChange={() => {
                setChoice(reason);
              }}
            />
          ))}
        </Fieldset>

        <div className="margin-top-2">
          <Label htmlFor="decision-note">Note (optional)</Label>
          <Textarea
            id="decision-note"
            name="decision-note"
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
            }}
          />
        </div>

        <ButtonGroup className="margin-top-3">
          <Button
            type="button"
            secondary={!approving}
            disabled={choice === null}
            onClick={() => {
              if (choice !== null) onConfirm(choice, note);
            }}
          >
            {approving ? "Yes, approve it" : "Reject application"}
          </Button>
          <Button type="button" unstyled onClick={onCancel} className="padding-105">
            Go back
          </Button>
        </ButtonGroup>
      </div>
    </div>
  );
}
