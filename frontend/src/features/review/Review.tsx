import { Button, Grid } from "@trussworks/react-uswds";

import { ResultAlert } from "../../components/feedback/ResultAlert";
import { StatusAlert } from "../../components/feedback/StatusAlert";
import { ResultTable } from "../../components/results/ResultTable";
import { labelImageUrl } from "../../services/api";
import type { ApplicationSummary, VerificationResponse } from "../../types";

interface ReviewProps {
  application: ApplicationSummary;
  result: VerificationResponse | null;
  error: string | null;
  busy: boolean;
  onBack: () => void;
  onRetry: () => void;
}

export function Review({
  application,
  result,
  error,
  busy,
  onBack,
  onRetry,
}: ReviewProps): React.ReactElement {
  return (
    <section>
      <Button type="button" unstyled onClick={onBack} className="margin-bottom-2">
        &larr; Back to the list
      </Button>

      <h2 className="font-heading-xl margin-bottom-0">{application.applicant}</h2>
      <p className="font-body-lg text-base-dark margin-top-05">
        Application {application.application_id}
      </p>

      <div aria-live="polite" aria-atomic="true">
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
              <Button type="button" onClick={onRetry}>
                Try again
              </Button>
            }
          >
            {error}
          </StatusAlert>
        )}
        {result && <ResultAlert result={result} />}
      </div>

      {result && (
        <Grid row gap className="margin-top-3">
          <Grid tablet={{ col: 7 }}>
            <h3 className="font-heading-lg">
              What the form says, and what the label shows
            </h3>
            <ResultTable
              fields={result.fields}
              claimedHeading="On the form"
              caption="Comparison of claimed and printed values"
            />
            <p className="font-body-sm text-base-dark">
              Checked in {result.elapsed_seconds.toFixed(1)} seconds. This tool
              reports what it read; approving or rejecting the label is your
              decision.
            </p>
          </Grid>
          <Grid tablet={{ col: 5 }}>
            <h3 className="font-heading-lg">The picture that was sent in</h3>
            <img
              src={labelImageUrl(application.application_id)}
              alt={`Label artwork submitted for ${application.application_id}`}
              className="width-full border-1px border-base-lighter"
            />
          </Grid>
        </Grid>
      )}
    </section>
  );
}
