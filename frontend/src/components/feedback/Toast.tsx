import { cx } from "../../styles/classNames";
import { Button } from "@trussworks/react-uswds";

import type { Toast as ToastMessage } from "../../hooks/useToast";
import styles from "./toast.module.scss";

interface ToastProps {
  toast: ToastMessage | null;
  onUndo: () => void;
  onDismiss: () => void;
}

/**
 * Confirms a recorded decision, and offers to take it back.
 *
 * Undo matters more here than in most toasts: decisions can be made with a
 * single keystroke, so an accidental one needs a visible way back that does not
 * require finding the application again.
 */
export function Toast({ toast, onUndo, onDismiss }: ToastProps): React.ReactElement {
  return (
    <div className={styles.region} role="status" aria-live="polite" aria-atomic="true">
      {toast !== null && (
        <div
          key={toast.id}
          className={cx(styles.toast,
            toast.status === "approved" ? styles.approved : styles.rejected,)}
        >
          <div className={styles.body}>
            <p className="font-body-sm text-bold margin-y-0">
              {toast.applicationId} {toast.status === "approved" ? "approved" : "rejected"}
            </p>
            <p className={cx("font-body-3xs margin-y-0", styles.detail)}>
              {toast.applicant}
              {toast.reason !== null && ` · ${toast.reason}`}
            </p>
          </div>
          <div className={styles.actions}>
            <Button type="button" unstyled onClick={onUndo}>
              Undo
            </Button>
            <Button
              type="button"
              unstyled
              onClick={onDismiss}
              aria-label="Dismiss"
              className={styles.close}
            >
              ×
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
