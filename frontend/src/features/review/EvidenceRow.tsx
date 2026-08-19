import { cx } from "../../styles/classNames";
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
    const same =
      result.extracted !== null &&
      result.extracted.toLowerCase() === result.claimed.toLowerCase();
    return same
      ? "Same wording, different capitalisation. This field is compared exactly."
      : "The printed warning is not the statutory text. This field is compared exactly.";
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

  const labelValue = busy
    ? "Reading…"
    : result === undefined
      ? "Not checked yet"
      : (result.extracted ?? "Not found on the label");

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
        <span
          className={[
            styles.pill,
            status === undefined ? styles.pillUnchecked : styles[status],
          ].join(" ")}
        >
          {status === undefined ? "Not checked" : STATUS_TEXT[status]}
        </span>
      </span>

      <span className={styles.valueGrid}>
        <span className="font-body-3xs text-base-dark">Form</span>
        <span className={styles.mono}>{claimed}</span>
        <span className="font-body-3xs text-base-dark">Label</span>
        <span
          className={cx(styles.mono, result?.extracted ? "" : styles.muted)}
        >
          {labelValue}
        </span>
      </span>

      {note !== null && <span className={styles.note}>{note}</span>}
    </button>
  );
}
