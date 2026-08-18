import { useEffect, useState } from "react";

import { fetchApplications } from "../services/api";
import { messageFor } from "../services/errors";
import type { ApplicationSummary } from "../types";

interface UseApplications {
  applications: ApplicationSummary[];
  error: string | null;
  loading: boolean;
}

/** Loads the pending queue once on mount. */
export function useApplications(): UseApplications {
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchApplications()
      .then((records) => {
        if (cancelled) return;
        setApplications(records);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(messageFor(cause));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { applications, error, loading };
}
