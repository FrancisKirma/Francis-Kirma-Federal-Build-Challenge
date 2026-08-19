import { cx } from "../../styles/classNames";
import styles from "./queue.module.scss";

export type QueueTab = "pending" | "approved" | "denied";

interface QueueTabsProps {
  active: QueueTab;
  counts: Record<QueueTab, number>;
  onChange: (tab: QueueTab) => void;
}

const TABS: { id: QueueTab; label: string }[] = [
  { id: "pending", label: "Waiting for review" },
  { id: "approved", label: "Approved" },
  { id: "denied", label: "Rejected" },
];

/**
 * Underline tabs rather than segmented buttons: they read as sections of one
 * list, and the active underline joins the panel below it.
 */
export function QueueTabs({
  active,
  counts,
  onChange,
}: QueueTabsProps): React.ReactElement {
  return (
    <nav aria-label="Filter applications by decision" className={styles.tabs}>
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={cx(styles.tab, active === tab.id ? styles.tabActive : "")}
          aria-pressed={active === tab.id}
          onClick={() => {
            onChange(tab.id);
          }}
        >
          {tab.label} ({counts[tab.id]})
        </button>
      ))}
    </nav>
  );
}
