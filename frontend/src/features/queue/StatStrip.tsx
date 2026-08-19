import { cx } from "../../styles/classNames";
import styles from "./queue.module.scss";

interface StatStripProps {
  pending: number;
  checked: number;
  total: number;
  flagged: number;
  decided: number;
}

/**
 * The shape of the work at a glance: how much is left, how much has been read,
 * and how much of it disagrees. "Need attention" turns red when non-zero
 * because it is the only number that changes what the agent does next.
 */
export function StatStrip({
  pending,
  checked,
  total,
  flagged,
  decided,
}: StatStripProps): React.ReactElement {
  const cells = [
    { label: "In the queue", value: String(pending), alarm: false },
    { label: "Checked", value: `${String(checked)}/${String(total)}`, alarm: false },
    { label: "Need attention", value: String(flagged), alarm: flagged > 0 },
    { label: "Decided", value: String(decided), alarm: false },
  ];

  return (
    <div className={styles.statStrip}>
      {cells.map((cell) => (
        <div key={cell.label} className={styles.statCell}>
          <span className={styles.statLabel}>{cell.label}</span>
          <span className={cx(styles.statValue, cell.alarm ? styles.alarm : "")}>
            {cell.value}
          </span>
        </div>
      ))}
    </div>
  );
}
