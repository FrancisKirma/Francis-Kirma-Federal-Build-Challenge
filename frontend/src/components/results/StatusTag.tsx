import { Tag } from "@trussworks/react-uswds";

import type { Status } from "../../types";

/**
 * Status is carried by words as well as colour: colour alone fails colour-blind
 * agents and Section 508. Both mappings live here so they cannot drift apart.
 */
const TEXT: Record<Status, string> = {
  match: "Match",
  mismatch: "Does not match",
  unreadable: "Could not read",
};

const STYLE: Record<Status, string> = {
  match: "bg-success-dark",
  mismatch: "bg-error-dark",
  unreadable: "bg-warning-dark text-ink",
};

export function StatusTag({ status }: { status: Status }): React.ReactElement {
  return (
    <Tag className={`${STYLE[status]} font-body-sm padding-x-1`}>{TEXT[status]}</Tag>
  );
}
