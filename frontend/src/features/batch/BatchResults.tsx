import { Button, Table, Tag } from "@trussworks/react-uswds";

import { StatusAlert } from "../../components/feedback/StatusAlert";
import type { BatchOutcome } from "../../types";

interface BatchResultsProps {
  outcomes: BatchOutcome[];
  onOpen: (id: string) => void;
  onBack: () => void;
}

/**
 * Rows are ordered problems first once they settle: a clean row needs a glance,
 * a flagged or unreadable one needs a decision.
 */
function rank(outcome: BatchOutcome): number {
  if (outcome.pending) return 3;
  if (outcome.error !== null) return 0;
  return outcome.result?.flagged === true ? 1 : 2;
}

export function BatchResults({
  outcomes,
  onOpen,
  onBack,
}: BatchResultsProps): React.ReactElement {
  const done = outcomes.filter((outcome) => !outcome.pending).length;
  const flagged = outcomes.filter(
    (outcome) => outcome.result?.flagged === true,
  ).length;
  const failed = outcomes.filter((outcome) => outcome.error !== null).length;
  const ordered = [...outcomes].sort((a, b) => rank(a) - rank(b));

  return (
    <section>
      <Button type="button" unstyled onClick={onBack} className="margin-bottom-2">
        &larr; Back to the list
      </Button>

      <h2 className="font-heading-xl margin-bottom-1">Checking several labels</h2>

      <div aria-live="polite" aria-atomic="true">
        {done < outcomes.length ? (
          <StatusAlert type="info" heading="Working through the list">
            Checked {done} of {outcomes.length}. Results appear as each one
            finishes.
          </StatusAlert>
        ) : (
          <StatusAlert
            type={flagged + failed > 0 ? "warning" : "success"}
            heading={
              flagged + failed > 0
                ? `${String(flagged + failed)} of ${String(outcomes.length)} need your attention`
                : "All labels match"
            }
          >
            {flagged + failed > 0
              ? "Those are listed first. Open one to see what differs."
              : "Every label matched the form it was sent with."}
          </StatusAlert>
        )}
      </div>

      <Table bordered fullWidth caption="Results for the selected labels" className="margin-top-2">
        <thead>
          <tr>
            <th scope="col">Application</th>
            <th scope="col">Company</th>
            <th scope="col">Result</th>
            <th scope="col">
              <span className="usa-sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((outcome) => (
            <tr key={outcome.application_id}>
              <th scope="row" className="text-normal">
                {outcome.application_id}
              </th>
              <td>{outcome.applicant}</td>
              <td>
                {outcome.pending && <span>Checking…</span>}
                {!outcome.pending && outcome.error !== null && (
                  <Tag className="bg-warning-dark text-ink">Could not read</Tag>
                )}
                {!outcome.pending && outcome.result && (
                  <Tag
                    className={
                      outcome.result.flagged ? "bg-error-dark" : "bg-success-dark"
                    }
                  >
                    {outcome.result.flagged ? "Needs attention" : "Everything matches"}
                  </Tag>
                )}
              </td>
              <td>
                <Button
                  type="button"
                  onClick={() => {
                    onOpen(outcome.application_id);
                  }}
                >
                  Open
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </section>
  );
}
