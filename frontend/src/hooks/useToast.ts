import { useCallback, useEffect, useState } from "react";

export interface Toast {
  message: string;
  tone: "success" | "info";
  /** Changes on every show so a repeated message still re-announces. */
  id: number;
}

/** How long a confirmation stays on screen before clearing itself. */
const VISIBLE_MS = 5000;

interface UseToast {
  toast: Toast | null;
  show: (message: string, tone?: Toast["tone"]) => void;
  dismiss: () => void;
}

/**
 * A short confirmation that something was recorded.
 *
 * Deliberately holds one message at a time: a stack of toasts is more to read,
 * and an agent deciding several applications wants the latest outcome, not a
 * history of them.
 */
export function useToast(): UseToast {
  const [toast, setToast] = useState<Toast | null>(null);

  const show = useCallback((message: string, tone: Toast["tone"] = "success") => {
    setToast({ message, tone, id: Date.now() });
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
