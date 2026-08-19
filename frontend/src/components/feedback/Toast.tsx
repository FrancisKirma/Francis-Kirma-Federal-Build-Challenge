import { Alert, Button } from "@trussworks/react-uswds";

import type { Toast as ToastMessage } from "../../hooks/useToast";
import styles from "./toast.module.scss";

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

/**
 * Confirms that a decision was recorded.
 *
 * The live region is always in the document rather than mounted with the
 * message: a region added at the same moment as its content is not reliably
 * announced. USWDS ships no toast, so this reuses Alert's styling to stay
 * visually part of the design system.
 */
export function Toast({ toast, onDismiss }: ToastProps): React.ReactElement {
  return (
    <div className={styles.region} role="status" aria-live="polite" aria-atomic="true">
      {toast !== null && (
        <div className={styles.toast} key={toast.id}>
          <Alert type={toast.tone} slim noIcon={false}>
            {toast.message}
            <Button
              type="button"
              unstyled
              className={styles.dismiss}
              onClick={onDismiss}
              aria-label="Dismiss this message"
            >
              Dismiss
            </Button>
          </Alert>
        </div>
      )}
    </div>
  );
}
