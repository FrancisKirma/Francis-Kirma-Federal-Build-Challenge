import { Table } from "@trussworks/react-uswds";

import type { FieldResult } from "../../types";
import { ResultRow } from "./ResultRow";

interface ResultTableProps {
  fields: FieldResult[];
  /** What the left-hand column came from: an application form, or typed input. */
  claimedHeading: string;
  caption: string;
}

export function ResultTable({
  fields,
  claimedHeading,
  caption,
}: ResultTableProps): React.ReactElement {
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
        {fields.map((field) => (
          <ResultRow key={field.field} result={field} />
        ))}
      </tbody>
    </Table>
  );
}
