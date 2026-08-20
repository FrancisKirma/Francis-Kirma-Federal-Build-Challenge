import { useCallback, useMemo, useState } from "react";
import { Button, ButtonGroup } from "@trussworks/react-uswds";

import { StatusAlert } from "./components/feedback/StatusAlert";
import { ReasonDialog } from "./components/feedback/ReasonDialog";
import { Toast } from "./components/feedback/Toast";
import { AppShell } from "./components/layout/AppShell";
import { BatchResults } from "./features/batch/BatchResults";
import { Queue } from "./features/queue/Queue";
import { QueueTabs, type QueueTab } from "./features/queue/QueueTabs";
import { StatStrip } from "./features/queue/StatStrip";
import { Review } from "./features/review/Review";
import { Upload } from "./features/upload/Upload";
import { WorklistRail } from "./features/worklist/WorklistRail";
import {
  csvFilename,
  downloadCsv,
  toCsv,
} from "./services/decisionExport";
import { useApplications } from "./hooks/useApplications";
import { useBatchVerification } from "./hooks/useBatchVerification";
import { useDecisions } from "./hooks/useDecisions";
import type { ApplicationSummary, BatchOutcome, DecisionStatus } from "./types";
import { useReviewKeys } from "./hooks/useReviewKeys";
import { useToast } from "./hooks/useToast";
import { useVerification } from "./hooks/useVerification";

type View = "queue" | "review" | "batch" | "upload";

export function App(): React.ReactElement {
  const { applications, error: loadError } = useApplications();
  const verification = useVerification();
  const batch = useBatchVerification();
  const { decisions, decide, undo, reset, counts } = useDecisions(applications.length);
  const { toast, show: showToast, dismiss: dismissToast } = useToast();

  const [view, setView] = useState<View>("queue");
  // Where a review was opened from, so deciding returns there. A batch is a
  // worklist: sending the agent back to the queue after every decision would
  // make them find their place again eight times over.
  const [returnTo, setReturnTo] = useState<"queue" | "batch">("queue");
  const [tab, setTab] = useState<QueueTab>("pending");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  // Which decision is awaiting a reason; null when no dialog is open.
  const [pendingDecision, setPendingDecision] = useState<DecisionStatus | null>(null);
  /** Application ids the agent chose to work through, and the lane J/K walks. */
  const [worklist, setWorklist] = useState<string[]>([]);
  /** The queue order at the moment a review was opened from it. */
  const [queueLane, setQueueLane] = useState<string[]>([]);
  /** Application ids in triage order, settled once a run of checks finishes. */
  const [triageOrder, setTriageOrder] = useState<string[]>([]);

  const visible = useMemo(() => {
    const inTab = applications.filter((application) => {
      const decision = decisions.get(application.application_id);
      if (tab === "pending") return decision === undefined;
      return decision?.status === tab;
    });
    if (tab !== "pending" || triageOrder.length === 0) return inTab;

    // Ordered by the last completed triage, not live. Re-ranking as each result
    // arrives would shuffle rows under the agent while they are reading them,
    // and would make Previous and Next point somewhere different from the list
    // on screen.
    const at = (id: string): number => {
      const index = triageOrder.indexOf(id);
      return index === -1 ? Number.MAX_SAFE_INTEGER : index;
    };
    return [...inTab].sort((a, b) => at(a.application_id) - at(b.application_id));
  }, [applications, decisions, tab, triageOrder]);

  const uncheckedPending = visible.filter(
    (a) => verification.resultFor(a.application_id) === null,
  );
  const flaggedCount = applications.filter(
    (a) => verification.resultFor(a.application_id)?.flagged === true,
  ).length;
  const checkedCount = applications.filter(
    (a) => verification.resultFor(a.application_id) !== null,
  ).length;

  // No check is started here: reading a label costs a vision-model call, so it
  // runs when the agent asks for it. Any result already held for this
  // application -- from an earlier look or a batch run -- is shown as it is.
  const openReview = useCallback(
    (id: string, from: "queue" | "batch" = "queue") => {
      setActiveId(id);
      setReturnTo(from);
      setView("review");
      // The list as the agent sees it, so stepping matches the rows on screen.
      if (from === "queue") {
        setQueueLane(visible.map((a) => a.application_id));
      }
    },
    [visible],
  );

  // The queue order only changes when a run of checks settles, so the lane can
  // follow what is on screen: Previous and Next always mean the row above and
  // the row below.
  const laneIds =
    returnTo === "batch" && worklist.length > 0
      ? worklist
      : queueLane.length > 0
        ? queueLane
        : visible.map((a) => a.application_id);
  const laneItems = laneIds
    .map((id) => applications.find((a) => a.application_id === id))
    .filter((a): a is ApplicationSummary => a !== undefined);

  const active = applications.find((a) => a.application_id === activeId) ?? null;

  const step = useCallback(
    (delta: number) => {
      if (activeId === null) return;
      const at = laneIds.indexOf(activeId);
      const next = laneIds[at + delta];
      if (at !== -1 && next !== undefined) openReview(next, returnTo);
    },
    [activeId, laneIds, openReview, returnTo],
  );

  const commitDecision = useCallback(
    (status: DecisionStatus, reason: string | null, note: string) => {
      if (active === null) return;
      const current = verification.resultFor(active.application_id);
      if (current === null) return;

      decide(active.application_id, status, current, reason, note);
      showToast({
        applicationId: active.application_id,
        applicant: active.applicant,
        status,
        reason,
      });
      setPendingDecision(null);

      // In a worklist, move to the next item instead of leaving: the agent
      // chose this set to work through without returning to the queue.
      const at = laneIds.indexOf(active.application_id);
      const next = returnTo === "batch" ? laneIds[at + 1] : undefined;
      if (next !== undefined) {
        openReview(next, returnTo);
        return;
      }
      if (returnTo === "queue") setSelected(new Set());
      setView(returnTo);
    },
    [active, decide, laneIds, openReview, returnTo, showToast, verification],
  );
  const toQueue = useCallback(() => {
    setView("queue");
  }, []);
  const leaveReview = useCallback(() => {
    setView(returnTo);
  }, [returnTo]);

  /**
   * Return the session to how it opened.
   *
   * Clearing only the decisions leaves every label still marked checked, with
   * its signal and the "5 need attention" count intact -- which reads as a
   * half-finished reset rather than a deliberate one.
   */
  const clearEverything = useCallback(() => {
    reset();
    verification.clear();
    setSelected(new Set());
    setWorklist([]);
    setQueueLane([]);
    setTriageOrder([]);
    setTab("pending");
    dismissToast();
  }, [dismissToast, reset, verification]);

  /**
   * Fix the queue order once a run of checks has finished.
   *
   * Sorting live would move rows while the agent reads them; sorting once at
   * the end puts what needs attention first and then holds still.
   */
  const settleTriageOrder = useCallback(
    (outcomes: BatchOutcome[]) => {
      // Ranked from the run's own outcomes rather than the results store: the
      // store read here would come from the render that started the run, when
      // nothing had been read yet.
      const flagged = new Set(
        outcomes
          .filter((outcome) => outcome.result?.flagged === true)
          .map((outcome) => outcome.application_id),
      );
      const unread = new Set(
        outcomes
          .filter((outcome) => outcome.result === null)
          .map((outcome) => outcome.application_id),
      );
      const rank = (id: string): number =>
        flagged.has(id) ? 0 : unread.has(id) ? 1 : 2;

      setTriageOrder(
        [...applications]
          .map((a) => a.application_id)
          .sort((a, b) => rank(a) - rank(b)),
      );
    },
    [applications],
  );

  const handleDecide = useCallback(
    (status: DecisionStatus) => {
      if (active === null) return;
      const current = verification.resultFor(active.application_id);
      if (current === null) return;
      // A rejection, or an approval over a disagreement, has to say why: those
      // are the decisions a later reader cannot infer from the evidence alone.
      if (status === "denied" || current.flagged) {
        setPendingDecision(status);
        return;
      }
      commitDecision(status, null, "");
    },
    [active, commitDecision, verification],
  );

  useReviewKeys({
    enabled: view === "review" && pendingDecision === null,
    onBack: leaveReview,
    onApprove: () => {
      if (active !== null && verification.resultFor(active.application_id) !== null) {
        handleDecide("approved");
      }
    },
    onReject: () => {
      if (active !== null && verification.resultFor(active.application_id) !== null) {
        handleDecide("denied");
      }
    },
    onNext: () => {
      step(1);
    },
    onPrevious: () => {
      step(-1);
    },
  });

  return (
    <AppShell>
      {loadError !== null && (
        <StatusAlert type="error" heading="Could not load the list">
          {loadError}
        </StatusAlert>
      )}

      {view === "queue" && (
        <>
          <div className="display-flex flex-justify flex-wrap margin-bottom-2">
            <div>
              <h2 className="font-heading-xl margin-y-0">
                {tab === "pending"
                  ? "Applications waiting for review"
                  : tab === "approved"
                    ? "Applications you approved"
                    : "Applications you rejected"}
              </h2>
              <p className="font-body-md text-base-dark margin-top-05 margin-bottom-0">
                {tab === "pending"
                  ? "Check the labels first, then open the ones the tool flagged."
                  : `You marked these ${
                      tab === "approved" ? "approved" : "rejected"
                    }. Open one to change your decision.`}
              </p>
            </div>
            {tab === "pending" && (
              <ButtonGroup>
                <Button
                  type="button"
                  disabled={uncheckedPending.length === 0}
                  onClick={() => {
                    void batch
                      .run(uncheckedPending, verification.remember)
                      .then(settleTriageOrder);
                  }}
                >
                  {uncheckedPending.length === 0
                    ? "All pending labels checked"
                    : `Check all ${String(uncheckedPending.length)} pending labels`}
                </Button>
                <Button
                  type="button"
                  outline
                  disabled={selected.size === 0}
                  onClick={() => {
                    const chosen = visible.filter((a) =>
                      selected.has(a.application_id),
                    );
                    setWorklist(chosen.map((a) => a.application_id));
                    void batch.run(chosen, verification.remember);
                    const [first] = chosen;
                    if (first !== undefined) openReview(first.application_id, "batch");
                  }}
                >
                  {selected.size === 0
                    ? "Work through selected"
                    : `Work through ${String(selected.size)} selected`}
                </Button>
              </ButtonGroup>
            )}
          </div>

          <StatStrip
            pending={counts.pending}
            checked={checkedCount}
            total={applications.length}
            flagged={flaggedCount}
            decided={counts.approved + counts.denied}
          />

          <QueueTabs
            active={tab}
            counts={counts}
            onChange={(next) => {
              setTab(next);
              setSelected(new Set());
            }}
          />
          <Queue
            applications={visible}
            decisions={decisions}
            resultFor={verification.resultFor}
            isBusy={verification.isBusy}
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
            onReview={(id) => {
              openReview(id, "queue");
              if (verification.resultFor(id) === null) verification.verify(id);
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
                outline
                className="margin-left-2"
                onClick={() => {
                  const exportedAt = new Date().toISOString();
                  downloadCsv(
                    toCsv(applications, decisions, exportedAt),
                    csvFilename(exportedAt),
                  );
                }}
              >
                Download decisions
              </Button>
            )}
            {/* Checks alone mark up the queue, so clearing cannot wait for a
                decision: a batch run the agent wants to start over from leaves
                ten rows checked and nothing decided. */}
            {counts.approved + counts.denied + verification.checkedCount > 0 && (
              <Button
                type="button"
                unstyled
                className="margin-left-3"
                onClick={clearEverything}
              >
                {counts.approved + counts.denied > 0
                  ? "Clear all decisions"
                  : "Clear all checks"}
              </Button>
            )}
          </div>
        </>
      )}

      {view === "review" && active && (
        <div className="display-flex flex-align-start" style={{ gap: "20px" }}>
          {returnTo === "batch" && laneItems.length > 0 && (
            <WorklistRail
              items={laneItems}
              currentId={active.application_id}
              decisions={decisions}
              resultFor={verification.resultFor}
              isBusy={verification.isBusy}
              onOpen={(id) => {
                openReview(id, "batch");
              }}
            />
          )}
          <div className="flex-fill minw-0">
        {/* Keyed per application: a focused region and zoom belong to one
            artwork and must not carry across. */}
        <Review
          key={active.application_id}
          application={active}
          result={verification.resultFor(active.application_id)}
          error={verification.errorFor(active.application_id)}
          busy={verification.isBusy(active.application_id)}
          decision={decisions.get(active.application_id)}
          onDecide={handleDecide}
          onBack={leaveReview}
          listName={
            returnTo === "batch" ? "Checked labels" : "Applications waiting for review"
          }
          position={(() => {
            const at = laneIds.indexOf(active.application_id);
            return at === -1 ? null : { index: at + 1, total: laneIds.length };
          })()}
          onPrevious={
            laneIds.indexOf(active.application_id) > 0
              ? () => {
                  step(-1);
                }
              : null
          }
          onNext={
            laneIds.indexOf(active.application_id) < laneIds.length - 1
              ? () => {
                  step(1);
                }
              : null
          }
          onVerify={() => {
            verification.verify(active.application_id);
          }}
        />
          </div>
        </div>
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
      {/* Keyed so each decision opens a fresh dialog: a reason belongs to one
          decision and must not be inherited by the next. */}
      <ReasonDialog
        key={`${activeId ?? ""}-${pendingDecision ?? ""}`}
        mode={pendingDecision}
        flaggedFields={
          active
            ? (verification
                .resultFor(active.application_id)
                ?.fields.filter((f) => f.status !== "match")
                .map((f) => f.field) ?? [])
            : []
        }
        onConfirm={(reason, note) => {
          if (pendingDecision !== null) commitDecision(pendingDecision, reason, note);
        }}
        onCancel={() => {
          setPendingDecision(null);
        }}
      />
      <Toast
        toast={toast}
        onUndo={() => {
          if (toast === null) return;
          // Undo returns the application to how it was before the agent
          // touched it: not decided, and not checked either. Leaving the
          // reading behind would show a label the agent never chose to read.
          undo(toast.applicationId);
          verification.forget(toast.applicationId);
          dismissToast();
          setView("queue");
        }}
        onDismiss={dismissToast}
      />
    </AppShell>
  );
}
