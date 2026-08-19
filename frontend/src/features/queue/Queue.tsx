import { Button, Checkbox, Table } from "@trussworks/react-uswds";

import type {
  ApplicationSummary,
  Decision,
  VerificationResponse,
} from "../../types";
import styles from "./queue.module.scss";
import { SignalPill } from "./SignalPill";
import type { QueueTab } from "./QueueTabs";

interface QueueProps {
  applications: ApplicationSummary[];
  decisions: ReadonlyMap<string, Decision>;
  resultFor: (id: string) => VerificationResponse | null;
  isBusy: (id: string) => boolean;
  tab: QueueTab;
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onReview: (id: string) => void;
}

const EMPTY: Record<QueueTab, string> = {
  pending: "Every application has been decided.",
  approved: "You have not approved any applications yet.",
  denied: "You have not rejected any applications yet.",
};

const HEADING: Record<QueueTab, string> = {
  pending: "Applications waiting for review",
  approved: "Applications you approved",
  denied: "Applications you rejected",
};

/** HH:MM is enough to place a decision in a shift; the date is the row's own. */
function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function Queue({
  applications,
  decisions,
  resultFor,
  isBusy,
  tab,
  selected,
  onToggle,
  onToggleAll,
  onReview,
}: QueueProps): React.ReactElement {
  const isPending = tab === "pending";
  const allSelected = applications.length > 0 && selected.size === applications.length;

  if (applications.length === 0) {
    return <p className="font-body-lg padding-y-4 text-base-dark">{EMPTY[tab]}</p>;
  }

  return (
    <Table bordered={false} fullWidth caption={HEADING[tab]} className="margin-y-0">
      <thead>
        <tr>
          {isPending && (
            <th scope="col">
              <Checkbox
                id="select-all"
                name="select-all"
                label={<span className="usa-sr-only">Select all</span>}
                checked={allSelected}
                onChange={onToggleAll}
              />
            </th>
          )}
          <th scope="col">Application</th>
          <th scope="col">Company</th>
          <th scope="col">Brand on the form</th>
          {isPending && <th scope="col">Signal</th>}
          <th scope="col">{isPending ? "Received" : "Decided"}</th>
          <th scope="col">
            <span className="usa-sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {applications.map((application) => {
          const id = application.application_id;
          const decision = decisions.get(id);
          const result = resultFor(id);
          const flagged = result?.flagged === true;

          return (
            <tr key={id} className={flagged && isPending ? styles.flaggedRow : ""}>
              {isPending && (
                <td>
                  <Checkbox
                    id={`select-${id}`}
                    name={`select-${id}`}
                    label={<span className="usa-sr-only">Select {id}</span>}
                    checked={selected.has(id)}
                    onChange={() => {
                      onToggle(id);
                    }}
                  />
                </td>
              )}
              <th scope="row" className={styles.monoId}>
                {id}
              </th>
              <td>{application.applicant}</td>
              <td>{application.submitted.brand_name}</td>
              {isPending && (
                <td>
                  <SignalPill result={result} busy={isBusy(id)} />
                </td>
              )}
              <td className="font-body-sm text-base-dark">
                {isPending || decision === undefined
                  ? application.submitted_date
                  : `${decision.status === "approved" ? "Approved" : "Rejected"} · ${timeOf(
                      decision.decidedAt,
                    )}${decision.reason === null ? "" : ` · ${decision.reason}`}`}
              </td>
              <td className="text-right">
                <Button
                  type="button"
                  outline={!flagged}
                  onClick={() => {
                    onReview(id);
                  }}
                >
                  {result === null ? "Open and check" : "Open"}
                </Button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
