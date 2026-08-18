import { Alert, AlertHeading, AlertText } from "@trussworks/react-uswds";

import type { VerificationResponse } from "../../types";

/**
 * The verdict in one sentence, before any table is read. An agent should know
 * whether a label needs attention without parsing five rows first.
 */
function summarise(result: VerificationResponse): { heading: string; body: string } {
  const problems = result.fields.filter((field) => field.status !== "match");
  if (problems.length === 0) {
    return {
      heading: "Everything matches",
      body: "All five items on the form match the picture of the label.",
    };
  }
  const noun = problems.length === 1 ? "item needs" : "items need";
  return {
    heading: `${String(problems.length)} ${noun} your attention`,
    body: "Look at the rows marked below and decide whether they are acceptable.",
  };
}

export function ResultAlert({
  result,
}: {
  result: VerificationResponse;
}): React.ReactElement {
  const { heading, body } = summarise(result);
  return (
    <Alert type={result.flagged ? "warning" : "success"}>
      <AlertHeading level="h3">{heading}</AlertHeading>
      <AlertText>{body}</AlertText>
    </Alert>
  );
}
