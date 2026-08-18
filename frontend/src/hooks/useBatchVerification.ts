import { useCallback, useState } from "react";

import { verifyApplication } from "../services/api";
import { messageFor } from "../services/errors";
import type { ApplicationSummary, BatchOutcome } from "../types";

/**
 * Labels are checked a few at a time. Each is its own request so rows appear as
 * they resolve, which keeps the per-label speed visible instead of hiding it
 * behind the slowest one, and stops one failure blanking the whole run.
 */
const CONCURRENCY = 4;

interface UseBatchVerification {
  outcomes: BatchOutcome[];
  run: (applications: ApplicationSummary[]) => Promise<void>;
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
    async (applications: ApplicationSummary[]) => {
      setOutcomes(
        applications.map((application) => ({
          application_id: application.application_id,
          applicant: application.applicant,
          result: null,
          error: null,
          pending: true,
        })),
      );

      const queue = [...applications];
      const worker = async (): Promise<void> => {
        for (;;) {
          const next = queue.shift();
          if (next === undefined) return;
          try {
            settle(next.application_id, {
              result: await verifyApplication(next.application_id),
            });
          } catch (cause: unknown) {
            settle(next.application_id, { error: messageFor(cause) });
          }
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, applications.length) }, worker),
      );
    },
    [settle],
  );

  return { outcomes, run };
}
