import { cx } from "../../styles/classNames";
import type {
  ApplicationSummary,
  Decision,
  VerificationResponse,
} from "../../types";
import styles from "./worklist.module.scss";

interface WorklistRailProps {
  items: ApplicationSummary[];
  currentId: string;
  decisions: ReadonlyMap<string, Decision>;
  resultFor: (id: string) => VerificationResponse | null;
  isBusy: (id: string) => boolean;
  onOpen: (id: string) => void;
}

function badge(
  decision: Decision | undefined,
  result: VerificationResponse | null,
  busy: boolean,
): { text: string; tone: string } {
  if (decision !== undefined) {
    return {
      text: decision.status === "approved" ? "Approved" : "Rejected",
      tone: "decided",
    };
  }
  if (busy) return { text: "Checking…", tone: "idle" };
  if (result === null) return { text: "Waiting", tone: "idle" };
  return result.flagged
    ? { text: "Needs attention", tone: "flagged" }
    : { text: "Matches", tone: "clean" };
}

/**
 * The set the agent chose to work through, kept beside the review.
 *
 * Staying in place between decisions is the point: returning to the queue after
 * each one means finding your position again on every application.
 */
export function WorklistRail({
  items,
  currentId,
  decisions,
  resultFor,
  isBusy,
  onOpen,
}: WorklistRailProps): React.ReactElement {
  return (
    <nav className={styles.rail} aria-label="Worklist">
      <div className={styles.railHeader}>
        <span className={styles.smallCaps}>Worklist</span>
        <p className="font-body-3xs text-base-dark margin-y-0">
          <kbd className={styles.kbd}>J</kbd> <kbd className={styles.kbd}>K</kbd> move ·{" "}
          <kbd className={styles.kbd}>A</kbd> approve ·{" "}
          <kbd className={styles.kbd}>R</kbd> reject
        </p>
      </div>
      {items.map((item) => {
        const id = item.application_id;
        const mark = badge(decisions.get(id), resultFor(id), isBusy(id));
        return (
          <button
            key={id}
            type="button"
            className={cx(styles.item, id === currentId ? styles.current : "")}
            aria-current={id === currentId ? "true" : undefined}
            onClick={() => {
              onOpen(id);
            }}
          >
            <span className={styles.itemId}>{id}</span>
            <span className="font-body-3xs text-base-dark">{item.applicant}</span>
            <span className={[styles.badge, styles[mark.tone]].join(" ")}>
              {mark.text}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
