import { useCallback, useMemo, useState } from "react";

import type { Decision, DecisionStatus, VerificationResponse } from "../types";

interface UseDecisions {
  decisions: ReadonlyMap<string, Decision>;
  decide: (
    applicationId: string,
    status: DecisionStatus,
    result: VerificationResponse,
  ) => void;
  reset: () => void;
  counts: Record<"pending" | "approved" | "denied", number>;
}

/**
 * Holds the agent's approvals and denials for this session.
 *
 * Deliberately not persisted. The deployment target is serverless, so a
 * module-level store on the backend would vanish between requests and look like
 * a bug rather than a documented limit; a real audit trail needs a database and
 * is out of scope for a proof of concept. Keeping it in the page makes the
 * lifetime obvious: decisions last as long as the session, and the Reset button
 * clears them on purpose rather than by accident.
 */
export function useDecisions(total: number): UseDecisions {
  const [decisions, setDecisions] = useState<ReadonlyMap<string, Decision>>(
    new Map(),
  );

  const decide = useCallback(
    (applicationId: string, status: DecisionStatus, result: VerificationResponse) => {
      setDecisions((current) => {
        const next = new Map(current);
        next.set(applicationId, {
          status,
          decidedAt: new Date().toISOString(),
          flaggedFields: result.fields
            .filter((field) => field.status !== "match")
            .map((field) => field.field),
        });
        return next;
      });
    },
    [],
  );

  const reset = useCallback(() => {
    setDecisions(new Map());
  }, []);

  const counts = useMemo(() => {
    let approved = 0;
    let denied = 0;
    for (const decision of decisions.values()) {
      if (decision.status === "approved") approved += 1;
      else denied += 1;
    }
    return { pending: total - approved - denied, approved, denied };
  }, [decisions, total]);

  return { decisions, decide, reset, counts };
}
