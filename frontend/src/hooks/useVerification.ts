import { useCallback, useState } from "react";

import { verifyApplication, verifyUpload } from "../services/api";
import { messageFor } from "../services/errors";
import type { VerificationResponse } from "../types";

/** The ad-hoc upload has no application id, so it gets its own slot. */
const UPLOAD_KEY = "__upload__";

interface UseVerification {
  resultFor: (key: string) => VerificationResponse | null;
  errorFor: (key: string) => string | null;
  isBusy: (key: string) => boolean;
  verify: (id: string) => void;
  upload: (image: File, claimed: Record<string, string | boolean>) => void;
  /** Record a result obtained elsewhere, such as a batch run. */
  remember: (id: string, result: VerificationResponse) => void;
  /** Forget one application's reading, returning it to unchecked. */
  forget: (id: string) => void;
  /** Forget every held reading, returning the queue to unchecked. */
  clear: () => void;
  uploadKey: string;
}

/**
 * Verification results, kept per application.
 *
 * Results are keyed rather than held one at a time so a check survives leaving
 * the screen: a batch run and a single review populate the same store, and
 * reopening an application shows what was already read instead of spending
 * another vision-model call on a label that has just been checked.
 */
export function useVerification(): UseVerification {
  const [results, setResults] = useState<ReadonlyMap<string, VerificationResponse>>(
    new Map(),
  );
  const [errors, setErrors] = useState<ReadonlyMap<string, string>>(new Map());
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());

  const patch = useCallback(
    (key: string, result: VerificationResponse | null, error: string | null) => {
      setResults((current) => {
        const next = new Map(current);
        if (result === null) next.delete(key);
        else next.set(key, result);
        return next;
      });
      setErrors((current) => {
        const next = new Map(current);
        if (error === null) next.delete(key);
        else next.set(key, error);
        return next;
      });
      setBusy((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    },
    [],
  );

  const run = useCallback(
    (key: string, work: () => Promise<VerificationResponse>) => {
      setBusy((current) => new Set(current).add(key));
      setErrors((current) => {
        const next = new Map(current);
        next.delete(key);
        return next;
      });
      work()
        .then((result) => {
          patch(key, result, null);
        })
        .catch((cause: unknown) => {
          patch(key, null, messageFor(cause));
        });
    },
    [patch],
  );

  const verify = useCallback(
    (id: string) => {
      run(id, () => verifyApplication(id));
    },
    [run],
  );

  const upload = useCallback(
    (image: File, claimed: Record<string, string | boolean>) => {
      run(UPLOAD_KEY, () => verifyUpload(image, claimed));
    },
    [run],
  );

  const remember = useCallback(
    (id: string, result: VerificationResponse) => {
      patch(id, result, null);
    },
    [patch],
  );

  const forget = useCallback(
    (id: string) => {
      patch(id, null, null);
    },
    [patch],
  );

  const clear = useCallback(() => {
    setResults(new Map());
    setErrors(new Map());
    setBusy(new Set());
  }, []);

  return {
    resultFor: useCallback((key: string) => results.get(key) ?? null, [results]),
    errorFor: useCallback((key: string) => errors.get(key) ?? null, [errors]),
    isBusy: useCallback((key: string) => busy.has(key), [busy]),
    verify,
    upload,
    remember,
    forget,
    clear,
    uploadKey: UPLOAD_KEY,
  };
}
