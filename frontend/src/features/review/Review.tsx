import { Button, Grid } from "@trussworks/react-uswds";

import { DecisionBar } from "../../components/feedback/DecisionBar";
import { ResultAlert } from "../../components/feedback/ResultAlert";
import { StatusAlert } from "../../components/feedback/StatusAlert";
import { ResultTable } from "../../components/results/ResultTable";
import { labelImageUrl } from "../../services/api";
import type {
  ApplicationSummary,
  Decision,
  DecisionStatus,
  VerificationResponse,
} from "../../types";

interface ReviewProps {
  application: ApplicationSummary;
  result: VerificationResponse | null;
  error: string | null;
  busy: boolean;
  decision: Decision | undefined;
  onVerify: () => void;
  onBack: () => void;
  /** Names where Back returns to, since a review can be opened from two places. */
  backLabel?: string;
  onDecide: (status: DecisionStatus) => void;
}

export function Review({
  application,
  result,
  error,
  busy,
  decision,
  onVerify,
  onBack,
  backLabel = "Back to the list",
  onDecide,
}: ReviewProps): React.ReactElement {
  return (
    <section>
      <Button type="button" unstyled onClick={onBack} className="margin-bottom-2">
        &larr; {backLabel}
      </Button>

      <div className="display-flex flex-align-center flex-justify margin-bottom-2 flex-wrap">
        <div>
          <h2 className="font-heading-lg margin-bottom-0">{application.applicant}</h2>
          <p className="font-body-md text-base-dark margin-y-0">
            Application {application.application_id}
          </p>
        </div>
        {/* Reading the label costs a call to the vision model, so it happens when
            the agent asks for it rather than on every glance at an application. */}
        <Button type="button" size="big" onClick={onVerify} disabled={busy}>
          {busy
            ? "Checking the label…"
            : result === null
              ? "Verify this label"
              : "Check it again"}
        </Button>
      </div>

      {/* The decision sits above the table: the agent should not have to scroll
          past the evidence to act on it. */}
      <DecisionBar result={result} existing={decision} onDecide={onDecide} />

      <div aria-live="polite" aria-atomic="true" className="margin-top-2">
        {busy && (
          <StatusAlert type="info" heading="Checking this label">
            Reading the picture and comparing it with the form. This takes a few
            seconds.
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
        {result && !busy && <ResultAlert result={result} />}
      </div>

      <Grid row gap className="margin-top-3">
        <Grid tablet={{ col: 7 }}>
          <h3 className="font-heading-md margin-bottom-1">
            What the form says, and what the label shows
          </h3>
          {result === null && !busy && (
            <p className="font-body-md text-base-dark margin-top-0">
              Choose <strong>Verify this label</strong> to read the picture and fill
              in the last two columns.
            </p>
          )}
          {result !== null && !busy && (
            <p className="font-body-sm text-base-dark margin-top-0 margin-bottom-1">
              Showing the last check of this label. Choose{" "}
              <strong>Check it again</strong> to read the picture afresh.
            </p>
          )}
          <ResultTable
            claimed={application.submitted}
            fields={result?.fields ?? null}
            busy={busy}
            claimedHeading="On the form"
            caption="Comparison of claimed and printed values"
          />
          {result && (
            <p className="font-body-sm text-base-dark margin-top-1">
              Checked in {result.elapsed_seconds.toFixed(1)} seconds. This tool
              reports what it read; the determination is yours.
            </p>
          )}
        </Grid>
        <Grid tablet={{ col: 5 }}>
          <h3 className="font-heading-md margin-bottom-1">
            The picture that was sent in
          </h3>
          <img
            src={labelImageUrl(application.application_id)}
            alt={`Label artwork submitted for ${application.application_id}`}
            className="width-full border-1px border-base-lighter"
          />
        </Grid>
      </Grid>
    </section>
  );
}
