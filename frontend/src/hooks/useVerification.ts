import { useCallback, useState } from "react";

import { verifyApplication, verifyUpload } from "../services/api";
import { messageFor } from "../services/errors";
import type { VerificationResponse } from "../types";

interface UseVerification {
  result: VerificationResponse | null;
  error: string | null;
  busy: boolean;
  verify: (id: string) => void;
  upload: (image: File, claimed: Record<string, string | boolean>) => void;
  reset: () => void;
}

/** Runs one verification at a time and tracks its outcome. */
export function useVerification(): UseVerification {
  const [result, setResult] = useState<VerificationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback((work: () => Promise<VerificationResponse>) => {
    setBusy(true);
    setResult(null);
    setError(null);
    work()
      .then(setResult)
      .catch((cause: unknown) => {
        setError(messageFor(cause));
      })
      .finally(() => {
        setBusy(false);
      });
  }, []);

  const verify = useCallback(
    (id: string) => {
      run(() => verifyApplication(id));
    },
    [run],
  );

  const upload = useCallback(
    (image: File, claimed: Record<string, string | boolean>) => {
      run(() => verifyUpload(image, claimed));
    },
    [run],
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, error, busy, verify, upload, reset };
}
