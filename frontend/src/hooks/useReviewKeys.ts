import { useEffect } from "react";

interface ReviewKeyHandlers {
  /** Inert while a dialog is open or the agent is typing. */
  enabled: boolean;
  onBack: () => void;
  onApprove: () => void;
  onReject: () => void;
  onNext: () => void;
  onPrevious: () => void;
}

/** True when the keystroke belongs to whatever the agent is typing into. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  );
}

/**
 * Keyboard shortcuts for working a list of applications.
 *
 * Decisions are one keystroke, which is why the confirmation toast offers Undo:
 * a mistyped A or R has to be recoverable without hunting for the application
 * again.
 */
export function useReviewKeys({
  enabled,
  onBack,
  onApprove,
  onReject,
  onNext,
  onPrevious,
}: ReviewKeyHandlers): void {
  useEffect(() => {
    if (!enabled) return undefined;

    const onKey = (event: KeyboardEvent): void => {
      if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const actions: Record<string, (() => void) | undefined> = {
        Escape: onBack,
        a: onApprove,
        r: onReject,
        j: onNext,
        k: onPrevious,
      };
      const action = actions[event.key.length === 1 ? event.key.toLowerCase() : event.key];
      if (action !== undefined) {
        event.preventDefault();
        action();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [enabled, onBack, onApprove, onReject, onNext, onPrevious]);
}
