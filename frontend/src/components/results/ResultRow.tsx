import { FIELD_LABELS, type FieldResult } from "../../types";
import { StatusTag } from "./StatusTag";

export function ResultRow({ result }: { result: FieldResult }): React.ReactElement {
  const label = FIELD_LABELS[result.field] ?? result.field;
  const isWarning = result.field === "government_warning";

  return (
    <tr>
      <th scope="row" className="font-body-md text-normal">
        {label}
      </th>
      <td className="font-body-md">
        {isWarning ? (
          <span>{result.claimed === "True" ? "Stated as present" : "Not stated"}</span>
        ) : (
          result.claimed
        )}
      </td>
      <td className="font-body-md">
        {result.extracted === null ? (
          <span className="text-base">Not found on the label</span>
        ) : (
          result.extracted
        )}
      </td>
      <td>
        <StatusTag status={result.status} />
      </td>
    </tr>
  );
}
