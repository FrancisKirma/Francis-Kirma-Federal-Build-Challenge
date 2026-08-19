import { useCallback, useMemo, useState } from "react";
import { Button } from "@trussworks/react-uswds";

import { StatusAlert } from "./components/feedback/StatusAlert";
import { Toast } from "./components/feedback/Toast";
import { AppShell } from "./components/layout/AppShell";
import { BatchResults } from "./features/batch/BatchResults";
import { Queue } from "./features/queue/Queue";
import { QueueTabs, type QueueTab } from "./features/queue/QueueTabs";
import { Review } from "./features/review/Review";
import { Upload } from "./features/upload/Upload";
import { useApplications } from "./hooks/useApplications";
import { useBatchVerification } from "./hooks/useBatchVerification";
import { useDecisions } from "./hooks/useDecisions";
import { useToast } from "./hooks/useToast";
import { useVerification } from "./hooks/useVerification";

type View = "queue" | "review" | "batch" | "upload";

export function App(): React.ReactElement {
  const { applications, error: loadError } = useApplications();
  const verification = useVerification();
  const batch = useBatchVerification();
  const { decisions, decide, reset, counts } = useDecisions(applications.length);
  const { toast, show: showToast, dismiss: dismissToast } = useToast();

  const [view, setView] = useState<View>("queue");
  // Where a review was opened from, so deciding returns there. A batch is a
  // worklist: sending the agent back to the queue after every decision would
  // make them find their place again eight times over.
  const [returnTo, setReturnTo] = useState<"queue" | "batch">("queue");
  const [tab, setTab] = useState<QueueTab>("pending");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);

  const visible = useMemo(
    () =>
      applications.filter((application) => {
        const decision = decisions.get(application.application_id);
        if (tab === "pending") return decision === undefined;
        return decision?.status === tab;
      }),
    [applications, decisions, tab],
  );

  // No check is started here: reading a label costs a vision-model call, so it
  // runs when the agent asks for it. Any result already held for this
  // application -- from an earlier look or a batch run -- is shown as it is.
  const openReview = useCallback((id: string, from: "queue" | "batch" = "queue") => {
    setActiveId(id);
    setReturnTo(from);
    setView("review");
  }, []);

  const active = applications.find((a) => a.application_id === activeId) ?? null;
  const toQueue = useCallback(() => {
    setView("queue");
  }, []);
  const leaveReview = useCallback(() => {
    setView(returnTo);
  }, [returnTo]);

  return (
    <AppShell>
      {loadError !== null && (
        <StatusAlert type="error" heading="Could not load the list">
          {loadError}
        </StatusAlert>
      )}

      {view === "queue" && (
        <>
          <QueueTabs active={tab} counts={counts} onChange={setTab} />
          <Queue
            applications={visible}
            decisions={decisions}
            tab={tab}
            selected={selected}
            onToggle={(id) => {
              const next = new Set(selected);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              setSelected(next);
            }}
            onToggleAll={() => {
              setSelected(
                selected.size === visible.length
                  ? new Set()
                  : new Set(visible.map((a) => a.application_id)),
              );
            }}
            onReview={openReview}
            onCheckSelected={() => {
              setView("batch");
              void batch.run(
                visible.filter((a) => selected.has(a.application_id)),
                verification.remember,
              );
            }}
          />
          <div className="margin-top-4 padding-top-3 border-top-1px border-base-lighter">
            <Button
              type="button"
              outline
              onClick={() => {
                setView("upload");
              }}
            >
              Check a label that is not on the list
            </Button>
            {counts.approved + counts.denied > 0 && (
              <Button
                type="button"
                unstyled
                className="margin-left-3"
                onClick={() => {
                  const cleared = counts.approved + counts.denied;
                  reset();
                  showToast(
                    `Cleared ${String(cleared)} decision${cleared === 1 ? "" : "s"}.`,
                    "info",
                  );
                }}
              >
                Clear all decisions
              </Button>
            )}
          </div>
        </>
      )}

      {view === "review" && active && (
        <Review
          application={active}
          result={verification.resultFor(active.application_id)}
          error={verification.errorFor(active.application_id)}
          busy={verification.isBusy(active.application_id)}
          decision={decisions.get(active.application_id)}
          onDecide={(status) => {
            const current = verification.resultFor(active.application_id);
            if (current === null) return;
            decide(active.application_id, status, current);
            showToast(
              `${active.application_id} marked ${
                status === "approved" ? "approved" : "rejected"
              }.`,
              status === "approved" ? "success" : "info",
            );
            if (returnTo === "queue") setSelected(new Set());
            setView(returnTo);
          }}
          onBack={leaveReview}
          backLabel={returnTo === "batch" ? "Back to the checked labels" : "Back to the list"}
          onVerify={() => {
            verification.verify(active.application_id);
          }}
        />
      )}

      {view === "batch" && (
        <BatchResults
          outcomes={batch.outcomes}
          decisions={decisions}
          onOpen={(id) => {
            openReview(id, "batch");
          }}
          onBack={toQueue}
        />
      )}

      {view === "upload" && (
        <Upload
          result={verification.resultFor(verification.uploadKey)}
          error={verification.errorFor(verification.uploadKey)}
          busy={verification.isBusy(verification.uploadKey)}
          onBack={toQueue}
          onVerify={verification.upload}
        />
      )}
      <Toast toast={toast} onDismiss={dismissToast} />
    </AppShell>
  );
}
