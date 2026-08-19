import { useCallback, useState } from "react";

import { verifyApplication } from "../services/api";
import { messageFor } from "../services/errors";
import type {
  ApplicationSummary,
  BatchOutcome,
  VerificationResponse,
} from "../types";

/**
 * Labels are checked a few at a time. Each is its own request so rows appear as
 * they resolve, which keeps the per-label speed visible instead of hiding it
 * behind the slowest one, and stops one failure blanking the whole run.
 */
const CONCURRENCY = 4;

interface UseBatchVerification {
  outcomes: BatchOutcome[];
  /** Resolves with what the run produced, so a caller can order by it. */
  run: (
    applications: ApplicationSummary[],
    /** Hands each result to the shared store so opening a row reuses it. */
    remember: (id: string, result: VerificationResponse) => void,
  ) => Promise<BatchOutcome[]>;
}

export function useBatchVerification(): UseBatchVerification {
  const [outcomes, setOutcomes] = useState<BatchOutcome[]>([]);

  const settle = useCallback((id: string, patch: Partial<BatchOutcome>) => {
    setOutcomes((current) =>
      current.map((outcome) =>
        outcome.application_id === id
          ? { ...outcome, ...patch, pending: false }
          : outcome,
      ),
    );
  }, []);

  const run = useCallback(
    async (
      applications: ApplicationSummary[],
      remember: (id: string, result: VerificationResponse) => void,
    ) => {
      setOutcomes(
        applications.map((application) => ({
          application_id: application.application_id,
          applicant: application.applicant,
          result: null,
          error: null,
          pending: true,
        })),
      );

      const settled = new Map<string, BatchOutcome>();
      const queue = [...applications];
      const worker = async (): Promise<void> => {
        for (;;) {
          const next = queue.shift();
          if (next === undefined) return;
          const base: BatchOutcome = {
            application_id: next.application_id,
            applicant: next.applicant,
            result: null,
            error: null,
            pending: false,
          };
          try {
            const verified = await verifyApplication(next.application_id);
            remember(next.application_id, verified);
            settle(next.application_id, { result: verified });
            settled.set(next.application_id, { ...base, result: verified });
          } catch (cause: unknown) {
            const message = messageFor(cause);
            settle(next.application_id, { error: message });
            settled.set(next.application_id, { ...base, error: message });
          }
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, applications.length) }, worker),
      );
      return applications
        .map((application) => settled.get(application.application_id))
        .filter((outcome): outcome is BatchOutcome => outcome !== undefined);
    },
    [settle],
  );

  return { outcomes, run };
}
