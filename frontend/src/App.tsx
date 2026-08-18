import { useCallback, useState } from "react";
import { Button } from "@trussworks/react-uswds";

import { AppShell } from "./components/layout/AppShell";
import { StatusAlert } from "./components/feedback/StatusAlert";
import { BatchResults } from "./features/batch/BatchResults";
import { Queue } from "./features/queue/Queue";
import { Review } from "./features/review/Review";
import { Upload } from "./features/upload/Upload";
import { useApplications } from "./hooks/useApplications";
import { useBatchVerification } from "./hooks/useBatchVerification";
import { useVerification } from "./hooks/useVerification";

type View = "queue" | "review" | "batch" | "upload";

export function App(): React.ReactElement {
  const { applications, error: loadError } = useApplications();
  const verification = useVerification();
  const batch = useBatchVerification();

  const [view, setView] = useState<View>("queue");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);

  const openReview = useCallback(
    (id: string) => {
      setActiveId(id);
      setView("review");
      verification.verify(id);
    },
    [verification],
  );

  const active = applications.find((a) => a.application_id === activeId) ?? null;
  const toQueue = useCallback(() => {
    setView("queue");
  }, []);

  return (
    <AppShell>
      {loadError !== null && (
        <StatusAlert type="error" heading="Could not load the list">
          {loadError}
        </StatusAlert>
      )}

      {view === "queue" && (
        <>
          <Queue
            applications={applications}
            selected={selected}
            onToggle={(id) => {
              const next = new Set(selected);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              setSelected(next);
            }}
            onToggleAll={() => {
              setSelected(
                selected.size === applications.length
                  ? new Set()
                  : new Set(applications.map((a) => a.application_id)),
              );
            }}
            onReview={openReview}
            onCheckSelected={() => {
              setView("batch");
              void batch.run(
                applications.filter((a) => selected.has(a.application_id)),
              );
            }}
          />
          <div className="margin-top-4 padding-top-3 border-top-1px border-base-lighter">
            <Button
              type="button"
              outline
              onClick={() => {
                verification.reset();
                setView("upload");
              }}
            >
              Check a label that is not on the list
            </Button>
          </div>
        </>
      )}

      {view === "review" && active && (
        <Review
          application={active}
          result={verification.result}
          error={verification.error}
          busy={verification.busy}
          onBack={toQueue}
          onRetry={() => {
            verification.verify(active.application_id);
          }}
        />
      )}

      {view === "batch" && (
        <BatchResults outcomes={batch.outcomes} onOpen={openReview} onBack={toQueue} />
      )}

      {view === "upload" && (
        <Upload
          result={verification.result}
          error={verification.error}
          busy={verification.busy}
          onBack={toQueue}
          onVerify={verification.upload}
        />
      )}
    </AppShell>
  );
}
