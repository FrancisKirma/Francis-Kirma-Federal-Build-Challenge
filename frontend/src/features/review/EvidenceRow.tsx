import { cx } from "../../styles/classNames";
import { STATUTORY_WARNING } from "../../constants";
import { FIELD_LABELS, type FieldResult, type Status } from "../../types";
import styles from "./review.module.scss";

interface EvidenceRowProps {
  field: string;
  claimed: string;
  result: FieldResult | undefined;
  busy: boolean;
  focused: boolean;
  onFocus: () => void;
}

const STATUS_TEXT: Record<Status, string> = {
  match: "Match",
  mismatch: "Does not match",
  unreadable: "Could not read",
};

/**
 * Explains a disagreement in the terms the comparison engine used, so the agent
 * knows whether the tool found a real difference or absorbed a benign one.
 */
function explain(result: FieldResult): string | null {
  if (result.status === "unreadable") {
    return "Nothing found where this field belongs on the panel.";
  }
  if (result.status === "match") return null;

  if (result.field === "government_warning") {
    // The form only attests that a warning is present; the comparison is
    // against the statutory text, so an agent should not read this row as
    // "the form said yes and the label has one".
    const same =
      result.extracted !== null &&
      result.extracted.toLowerCase() === STATUTORY_WARNING.toLowerCase();
    return same
      ? "Same wording as the required statement, but different capitalisation. This field is compared exactly, so this does not pass."
      : "This is not the required statement. The wording must match 27 CFR 16.21 exactly.";
  }
  if (result.field === "alcohol_content" || result.field === "net_contents") {
    return `Form says ${result.claimed}; the label reads ${result.extracted ?? "nothing"}.`;
  }
  return "Not a wording variation the tool absorbs — a different claim.";
}

export function EvidenceRow({
  field,
  claimed,
  result,
  busy,
  focused,
  onFocus,
}: EvidenceRowProps): React.ReactElement {
  const status = result?.status;
  const note = result ? explain(result) : null;

  const labelValue =
    result === undefined ? "Not checked yet" : (result.extracted ?? "Not found on the label");

  return (
    <button
      type="button"
      className={cx(styles.evidenceRow,
        focused ? styles.focused : "",
        status === "mismatch" ? styles.mismatch : "",
        status === "unreadable" ? styles.unreadable : "",)}
      aria-pressed={focused}
      onClick={onFocus}
    >
      <span className={styles.evidenceTop}>
        <span className="font-body-sm text-bold">{FIELD_LABELS[field] ?? field}</span>
        {busy ? (
          <span className={cx(styles.skeleton, styles.skeletonPill)} aria-hidden="true">
            <span className={styles.skeletonBar} />
          </span>
        ) : (
          <span
            className={cx(
              styles.pill,
              status === undefined ? styles.pillUnchecked : styles[status],
            )}
          >
            {status === undefined ? "Not checked" : STATUS_TEXT[status]}
          </span>
        )}
      </span>

      <span className={styles.valueGrid}>
        <span className="font-body-3xs text-base-dark">
          {field === "government_warning" ? "Required" : "Form"}
        </span>
        <span className={styles.mono}>{claimed}</span>
        <span className="font-body-3xs text-base-dark">Label</span>
        {busy ? (
          <span className={styles.skeleton} aria-label="Reading the label">
            <span className={styles.skeletonBar} />
          </span>
        ) : (
          <span className={cx(styles.mono, result?.extracted ? "" : styles.muted)}>
            {labelValue}
          </span>
        )}
      </span>

      {note !== null && <span className={styles.note}>{note}</span>}
    </button>
  );
}
