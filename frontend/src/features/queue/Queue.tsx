import { Button, Checkbox, Table, Tag } from "@trussworks/react-uswds";

import type { ApplicationSummary, Decision } from "../../types";
import type { QueueTab } from "./QueueTabs";

interface QueueProps {
  applications: ApplicationSummary[];
  decisions: ReadonlyMap<string, Decision>;
  tab: QueueTab;
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onReview: (id: string) => void;
  onCheckSelected: () => void;
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

const INTRO: Record<QueueTab, string> = {
  pending: "Open an application to check its label against the picture sent in.",
  approved: "You marked these approved. Open one to change your decision.",
  denied: "You marked these rejected. Open one to change your decision.",
};

export function Queue({
  applications,
  decisions,
  tab,
  selected,
  onToggle,
  onToggleAll,
  onReview,
  onCheckSelected,
}: QueueProps): React.ReactElement {
  const allSelected = applications.length > 0 && selected.size === applications.length;
  const isPending = tab === "pending";

  return (
    <section>
      <h2 className="font-heading-xl margin-bottom-1">{HEADING[tab]}</h2>
      <p className="font-body-lg text-base-dark margin-top-0 margin-bottom-3">
        {INTRO[tab]}
      </p>

      {applications.length === 0 ? (
        <p className="font-body-lg padding-y-4 text-base-dark">{EMPTY[tab]}</p>
      ) : (
        <>
          <Table bordered fullWidth caption={HEADING[tab]}>
            <thead>
              <tr>
                {isPending && (
                  <th scope="col">
                    <Checkbox
                      id="select-all"
                      name="select-all"
                      label="Select all"
                      checked={allSelected}
                      onChange={onToggleAll}
                    />
                  </th>
                )}
                <th scope="col">Application</th>
                <th scope="col">Company</th>
                <th scope="col">Brand on the form</th>
                {isPending ? (
                  <th scope="col">Received</th>
                ) : (
                  <th scope="col">Result at the time</th>
                )}
                <th scope="col">
                  <span className="usa-sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {applications.map((application) => {
                const decision = decisions.get(application.application_id);
                return (
                  <tr key={application.application_id}>
                    {isPending && (
                      <td>
                        <Checkbox
                          id={`select-${application.application_id}`}
                          name={`select-${application.application_id}`}
                          label={
                            <span className="usa-sr-only">
                              Select {application.application_id}
                            </span>
                          }
                          checked={selected.has(application.application_id)}
                          onChange={() => {
                            onToggle(application.application_id);
                          }}
                        />
                      </td>
                    )}
                    <th scope="row" className="text-normal">
                      {application.application_id}
                    </th>
                    <td>{application.applicant}</td>
                    <td>{application.submitted.brand_name}</td>
                    <td>
                      {isPending || decision === undefined ? (
                        application.submitted_date
                      ) : decision.flaggedFields.length === 0 ? (
                        <Tag className="bg-success-dark">Everything matched</Tag>
                      ) : (
                        <Tag className="bg-warning-dark text-ink">
                          {decision.flaggedFields.length} did not match
                        </Tag>
                      )}
                    </td>
                    <td>
                      <Button
                        type="button"
                        outline={!isPending}
                        onClick={() => {
                          onReview(application.application_id);
                        }}
                      >
                        {isPending ? "Review application" : "Open again"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>

          {isPending && (
            <div className="margin-top-3">
              <Button
                type="button"
                size="big"
                disabled={selected.size === 0}
                onClick={onCheckSelected}
              >
                {selected.size === 0
                  ? "Check selected labels"
                  : `Check ${String(selected.size)} selected label${selected.size === 1 ? "" : "s"}`}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
