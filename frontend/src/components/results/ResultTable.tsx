import { Table } from "@trussworks/react-uswds";

import { FIELD_LABELS, type ClaimedFields, type FieldResult } from "../../types";
import styles from "./results.module.scss";
import { StatusTag } from "./StatusTag";

interface ResultTableProps {
  /** What the applicant stated, shown before any check has run. */
  claimed: ClaimedFields;
  /** Filled in once the agent has asked for a check; null beforehand. */
  fields: FieldResult[] | null;
  /** True while the label is being read, so each pending cell can say so. */
  busy?: boolean;
  claimedHeading: string;
  caption: string;
}

const ORDER: (keyof ClaimedFields)[] = [
  "brand_name",
  "class_type",
  "alcohol_content",
  "net_contents",
  "government_warning",
];

/**
 * A cell with nothing in it yet.
 *
 * While a check is running this animates, so the wait is visible in the place
 * the answer will appear rather than only in the alert above the table.
 */
function PendingCell({ busy }: { busy: boolean }): React.ReactElement {
  if (!busy) {
    return (
      <span className="text-base" aria-label="Not checked yet">
        &mdash;
      </span>
    );
  }
  return (
    <span className={styles.pending} aria-label="Reading the label">
      <span className={styles.pendingBar} />
    </span>
  );
}

/** Long enough that the untruncated value would dominate the table. */
const LONG_VALUE_CHARS = 90;

/** Kept short so the expand link stays inside the collapsed row. */
const PREVIEW_CHARS = 55;

function isLong(value: string): boolean {
  return value.length > LONG_VALUE_CHARS;
}

/** Enough of the value to recognise the row without expanding it. */
function preview(value: string): string {
  return `${value.slice(0, PREVIEW_CHARS).trimEnd()}…`;
}

function claimedText(field: keyof ClaimedFields, claimed: ClaimedFields): string {
  if (field === "government_warning") {
    return claimed.government_warning ? "Stated as present" : "Not stated";
  }
  return claimed[field];
}

/**
 * The comparison, which exists in two states.
 *
 * Before a check the rows are still shown with the right-hand columns empty, so
 * the agent can see what is about to be checked and what the form claims. Only
 * the answers are withheld, not the structure -- a table that changes shape is
 * harder to reorient around than one that fills in.
 */
export function ResultTable({
  claimed,
  fields,
  claimedHeading,
  caption,
  busy = false,
}: ResultTableProps): React.ReactElement {
  const byField = new Map((fields ?? []).map((field) => [field.field, field]));

  return (
    <Table bordered fullWidth caption={caption}>
      <thead>
        <tr>
          <th scope="col">Item</th>
          <th scope="col">{claimedHeading}</th>
          <th scope="col">On the label</th>
          <th scope="col">Result</th>
        </tr>
      </thead>
      <tbody>
        {ORDER.map((field) => {
          const result = byField.get(field);
          return (
            <tr key={field}>
              <th scope="row" className="font-body-md text-normal">
                {FIELD_LABELS[field] ?? field}
              </th>
              <td className="font-body-md">{claimedText(field, claimed)}</td>
              <td className="font-body-md">
                {result === undefined ? (
                  <PendingCell busy={busy} />
                ) : result.extracted === null ? (
                  <span className="text-base">Not found on the label</span>
                ) : isLong(result.extracted) ? (
                  <details className={styles.expandable}>
                    <summary
                      aria-label={`Show the full ${(
                        FIELD_LABELS[field] ?? field
                      ).toLowerCase()} read from the label`}
                    >
                      <span className={styles.preview} aria-hidden="true">
                        {preview(result.extracted)}
                      </span>
                      <span className={styles.toggle} aria-hidden="true" />
                    </summary>
                    <p className={styles.full}>{result.extracted}</p>
                  </details>
                ) : (
                  result.extracted
                )}
              </td>
              <td>
                {result === undefined ? (
                  <PendingCell busy={busy} />
                ) : (
                  <StatusTag status={result.status} />
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
