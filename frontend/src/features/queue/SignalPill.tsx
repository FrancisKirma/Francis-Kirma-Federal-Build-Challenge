import { cx } from "../../styles/classNames";
import { FIELD_LABELS, type VerificationResponse } from "../../types";
import styles from "./queue.module.scss";

interface SignalProps {
  result: VerificationResponse | null;
  busy: boolean;
}

/**
 * What the tool found, before the agent opens anything.
 *
 * Naming the differing fields in the row is the point of triage: it lets the
 * agent choose what to open rather than opening everything to find out.
 */
export function SignalPill({ result, busy }: SignalProps): React.ReactElement {
  if (busy) {
    return <span className={cx(styles.pill, styles.pillIdle)}>Checking…</span>;
  }
  if (result === null) {
    return <span className={cx(styles.pill, styles.pillIdle)}>Not checked</span>;
  }

  const problems = result.fields.filter((f) => f.status !== "match");
  if (problems.length === 0) {
    return (
      <span className={cx(styles.pill, styles.pillClean)}>Everything matches</span>
    );
  }

  return (
    <>
      <span className={cx(styles.pill, styles.pillFlagged)}>
        {problems.length} {problems.length === 1 ? "needs" : "need"} attention
      </span>
      <span className={styles.signalFields}>
        {problems.map((f) => FIELD_LABELS[f.field] ?? f.field).join(", ")}
      </span>
    </>
  );
}
