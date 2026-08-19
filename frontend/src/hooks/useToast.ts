import { useCallback, useEffect, useState } from "react";

import type { DecisionStatus } from "../types";

export interface Toast {
  applicationId: string;
  applicant: string;
  status: DecisionStatus;
  reason: string | null;
  /** Changes on every show so a repeated outcome still re-announces. */
  id: number;
}

/** How long a confirmation stays before clearing itself. */
const VISIBLE_MS = 6000;

interface UseToast {
  toast: Toast | null;
  show: (toast: Omit<Toast, "id">) => void;
  dismiss: () => void;
}

/**
 * The confirmation that a decision was recorded.
 *
 * One at a time: an agent deciding several applications wants the latest
 * outcome and a way to take it back, not a stack of history to read.
 */
export function useToast(): UseToast {
  const [toast, setToast] = useState<Toast | null>(null);

  const show = useCallback((next: Omit<Toast, "id">) => {
    setToast({ ...next, id: Date.now() });
  }, []);

  const dismiss = useCallback(() => {
    setToast(null);
  }, []);

  useEffect(() => {
    if (toast === null) return undefined;
    const timer = setTimeout(() => {
      setToast(null);
    }, VISIBLE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [toast]);

  return { toast, show, dismiss };
}
