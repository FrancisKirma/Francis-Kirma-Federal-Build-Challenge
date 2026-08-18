import { Button, Checkbox, Table } from "@trussworks/react-uswds";

import type { ApplicationSummary } from "../../types";

interface QueueProps {
  applications: ApplicationSummary[];
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onReview: (id: string) => void;
  onCheckSelected: () => void;
}

export function Queue({
  applications,
  selected,
  onToggle,
  onToggleAll,
  onReview,
  onCheckSelected,
}: QueueProps): React.ReactElement {
  const allSelected = applications.length > 0 && selected.size === applications.length;

  return (
    <section>
      <h2 className="font-heading-xl margin-bottom-1">Labels waiting for review</h2>
      <p className="font-body-lg text-base-dark margin-top-0 margin-bottom-3">
        Choose a label to check it against the picture the company sent in.
      </p>

      <Table bordered fullWidth caption="Applications waiting for review">
        <thead>
          <tr>
            <th scope="col">
              <Checkbox
                id="select-all"
                name="select-all"
                label="Select all"
                checked={allSelected}
                onChange={onToggleAll}
              />
            </th>
            <th scope="col">Application</th>
            <th scope="col">Company</th>
            <th scope="col">Brand on the form</th>
            <th scope="col">Received</th>
            <th scope="col">
              <span className="usa-sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {applications.map((application) => (
            <tr key={application.application_id}>
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
              <th scope="row" className="text-normal">
                {application.application_id}
              </th>
              <td>{application.applicant}</td>
              <td>{application.submitted.brand_name}</td>
              <td>{application.submitted_date}</td>
              <td>
                <Button
                  type="button"
                  onClick={() => {
                    onReview(application.application_id);
                  }}
                >
                  Check this label
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

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
    </section>
  );
}
