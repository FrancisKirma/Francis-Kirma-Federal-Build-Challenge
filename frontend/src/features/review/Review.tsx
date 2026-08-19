import { useState } from "react";
import { Button, ButtonGroup } from "@trussworks/react-uswds";

import { StatusAlert } from "../../components/feedback/StatusAlert";
import { STATUTORY_WARNING } from "../../constants";
import { FIELD_ORDER, FIELD_LABELS } from "../../types";
import type {
  ApplicationSummary,
  Decision,
  DecisionStatus,
  VerificationResponse,
} from "../../types";
import { cx } from "../../styles/classNames";
import { ArtworkViewer } from "./ArtworkViewer";
import { EvidenceRow } from "./EvidenceRow";
import { zoomFor } from "./fieldRegions";
import styles from "./review.module.scss";

interface ReviewProps {
  application: ApplicationSummary;
  result: VerificationResponse | null;
  error: string | null;
  busy: boolean;
  decision: Decision | undefined;
  /** Where the agent came from, and their place in it. */
  listName: string;
  position: { index: number; total: number } | null;
  /** Move through the list without returning to it; null at either end. */
  onPrevious: (() => void) | null;
  onNext: (() => void) | null;
  onVerify: () => void;
  onBack: () => void;
  onDecide: (status: DecisionStatus) => void;
}

function claimedText(field: string, application: ApplicationSummary): string {
  if (field === "government_warning") {
    // The form only attests presence; what the label is measured against is the
    // statute, so that is what the row shows beside the printed text.
    return application.submitted.government_warning
      ? STATUTORY_WARNING
      : "The form does not state that a warning is present";
  }
  return String(application.submitted[field as keyof typeof application.submitted]);
}

/** Problems first once checked, so the agent reads what matters first. */
function orderedFields(result: VerificationResponse | null): string[] {
  if (result === null) return [...FIELD_ORDER];
  const rank = (field: string): number => {
    const found = result.fields.find((f) => f.field === field);
    return found === undefined || found.status === "match" ? 1 : 0;
  };
  return [...FIELD_ORDER].sort((a, b) => rank(a) - rank(b));
}

export function Review({
  application,
  result,
  error,
  busy,
  decision,
  listName,
  position,
  onPrevious,
  onNext,
  onVerify,
  onBack,
  onDecide,
}: ReviewProps): React.ReactElement {
  const [focusField, setFocusField] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const problems = result?.fields.filter((f) => f.status !== "match") ?? [];

  const hint =
    result === null
      ? "Verify the label first. A decision should follow a look at the evidence."
      : result.flagged
        ? "Approving this needs a recorded reason, because something does not match."
        : "Approving or rejecting is your determination, not the tool's.";

  return (
    <section>
      <div className={styles.contextBar}>
        <Button type="button" outline onClick={onBack}>
          <span aria-hidden="true">←</span> Back to the list
        </Button>
        <span className="font-body-sm text-base-dark">
          {listName} <span className="margin-x-05">/</span>
          <span className={cx("text-bold text-ink", styles.mono)}>
            {application.application_id}
          </span>
        </span>
        {position !== null && (
          <span className={cx("font-body-sm text-base-dark", styles.position)}>
            {position.index} of {position.total} in this list
          </span>
        )}
        {/* The same lane J and K walk, for anyone not using the keyboard. */}
        <span className={styles.stepButtons}>
          <Button
            type="button"
            outline
            disabled={onPrevious === null}
            onClick={() => onPrevious?.()}
          >
            <span aria-hidden="true">←</span> Previous
          </Button>
          <Button
            type="button"
            outline
            disabled={onNext === null}
            onClick={() => onNext?.()}
          >
            Next <span aria-hidden="true">→</span>
          </Button>
        </span>
        <span className="font-body-3xs text-base">
          Press <kbd className={styles.kbd}>Esc</kbd> to go back
        </span>
      </div>

      <div className={styles.body}>
        <section className={styles.panel} aria-label="Comparison">
          <header className={styles.evidenceHeader}>
            <div>
              <h2 className="font-heading-md margin-y-0">{application.applicant}</h2>
              <p className="font-body-3xs text-base-dark margin-y-0">
                Application {application.application_id} · filed{" "}
                {application.submitted_date}
              </p>
            </div>
            <Button type="button" onClick={onVerify} disabled={busy}>
              {busy ? "Checking…" : result === null ? "Verify this label" : "Check it again"}
            </Button>
          </header>

          <div aria-live="polite" aria-atomic="true">
            {busy && (
              <StatusAlert type="info" heading="Checking this label">
                Reading the picture and comparing it with the form.
              </StatusAlert>
            )}
            {error !== null && (
              <StatusAlert
                type="error"
                heading="Could not check this label"
                action={
                  <Button type="button" onClick={onVerify}>
                    Try again
                  </Button>
                }
              >
                {error}
              </StatusAlert>
            )}
            {result && !busy && (
              <div className={cx(styles.verdict, result.flagged && styles.verdictFlagged)}>
                <p className="font-body-sm text-bold margin-y-0">
                  {problems.length === 0
                    ? "Everything matches"
                    : `${String(problems.length)} item${
                        problems.length === 1 ? "" : "s"
                      } need${problems.length === 1 ? "s" : ""} your attention`}
                </p>
                <p className="font-body-sm margin-y-0">
                  {problems.length === 0
                    ? "All five items on the form match the picture of the label."
                    : `${problems
                        .map((f) => FIELD_LABELS[f.field] ?? f.field)
                        .join(", ")} — listed first below.`}
                </p>
              </div>
            )}
          </div>

          {orderedFields(result).map((field) => (
            <EvidenceRow
              key={field}
              field={field}
              claimed={claimedText(field, application)}
              result={result?.fields.find((f) => f.field === field)}
              busy={busy}
              focused={focusField === field}
              onFocus={() => {
                setFocusField(field);
                setZoom(zoomFor(field));
              }}
            />
          ))}

          {result && (
            <footer className={cx(styles.evidenceFooter, "font-body-3xs text-base-dark")}>
              Checked in {result.elapsed_seconds.toFixed(1)} seconds. Select a row to
              find it on the label. This tool reports what it read; the determination
              is yours.
            </footer>
          )}
        </section>

        <div className={styles.sticky}>
          <ArtworkViewer
            applicationId={application.application_id}
            focusField={focusField}
            zoom={zoom}
            onZoom={setZoom}
            onFit={() => {
              setFocusField(null);
              setZoom(1);
            }}
          />
        </div>
      </div>

      <div className={styles.dock}>
        <div className={styles.dockInner}>
          <div>
            <p className="font-body-sm text-bold margin-y-0">
              Your decision on {application.application_id}
            </p>
            <p className="font-body-3xs text-base-dark margin-y-0">
              {decision !== undefined
                ? `Already ${
                    decision.status === "approved" ? "approved" : "rejected"
                  }${decision.reason === null ? "" : ` — ${decision.reason}`}. Choosing again replaces that.`
                : hint}
            </p>
          </div>
          <div className={styles.dockActions}>
            <span className={cx("font-body-3xs text-base", styles.shortcutHint)}>
              <kbd className={styles.kbd}>A</kbd> approve ·{" "}
              <kbd className={styles.kbd}>R</kbd> reject
            </span>
            <ButtonGroup>
              <Button
                type="button"
                disabled={result === null}
                onClick={() => {
                  onDecide("approved");
                }}
              >
                Approve application
              </Button>
              <Button
                type="button"
                secondary
                disabled={result === null}
                onClick={() => {
                  onDecide("denied");
                }}
              >
                Reject application
              </Button>
            </ButtonGroup>
          </div>
        </div>
      </div>
    </section>
  );
}
