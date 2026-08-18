import { useRef, useState } from "react";
import {
  Button,
  ButtonGroup,
  Modal,
  ModalFooter,
  ModalHeading,
  ModalToggleButton,
  Tag,
} from "@trussworks/react-uswds";
import type { ModalRef } from "@trussworks/react-uswds";

import { FIELD_LABELS, type Decision, type VerificationResponse } from "../../types";

interface DecisionBarProps {
  /** Null until the agent has run a check; the decision buttons stay locked. */
  result: VerificationResponse | null;
  existing: Decision | undefined;
  onDecide: (status: "approved" | "denied") => void;
}

/**
 * Approve and deny, shown only once a check has produced a result.
 *
 * A tool that is easy to rubber-stamp is worse than no tool: it launders a
 * skipped check into a recorded approval. So the agent cannot reach these
 * buttons without the comparison on screen, and approving a label with a
 * disagreement asks them to confirm what they are overriding.
 */
export function DecisionBar({
  result,
  existing,
  onDecide,
}: DecisionBarProps): React.ReactElement {
  const modalRef = useRef<ModalRef>(null);
  const [pendingApproval, setPendingApproval] = useState(false);

  const problems = (result?.fields ?? []).filter((field) => field.status !== "match");
  const problemNames = problems
    .map((field) => FIELD_LABELS[field.field] ?? field.field)
    .join(", ");

  return (
    <div className="padding-2 bg-base-lightest radius-md">
      {existing !== undefined && (
        <p className="font-body-md text-base-dark margin-top-0">
          You marked this application{" "}
          <strong>{existing.status === "approved" ? "approved" : "denied"}</strong>.
          Choosing again replaces that.
        </p>
      )}

      <h3 className="font-heading-md margin-top-0 margin-bottom-1">
        Your decision
        {result === null && (
          <Tag className="bg-warning-dark text-ink font-body-sm margin-left-1 text-no-uppercase">
            Verify first
          </Tag>
        )}
      </h3>
      <p className="font-body-sm text-base-dark margin-top-0 margin-bottom-1">
        {result === null
          ? "Verify the label first. A decision should follow a look at the evidence, not replace it."
          : "Approving or rejecting this label is your determination, not the tool's."}
      </p>

      {result === null ? (
        <ButtonGroup>
          <Button type="button" disabled>
            Approve application
          </Button>
          <Button type="button" secondary disabled>
            Reject application
          </Button>
        </ButtonGroup>
      ) : (
      <ButtonGroup>
        {problems.length > 0 ? (
          <ModalToggleButton
            modalRef={modalRef}
            opener
            type="button"
            onClick={() => {
              setPendingApproval(true);
            }}
          >
            Approve application
          </ModalToggleButton>
        ) : (
          <Button
            type="button"
            onClick={() => {
              onDecide("approved");
            }}
          >
            Approve application
          </Button>
        )}
        <Button
          type="button"
          secondary
          onClick={() => {
            onDecide("denied");
          }}
        >
          Reject application
        </Button>
      </ButtonGroup>
      )}

      <Modal
        ref={modalRef}
        id="confirm-approval"
        aria-labelledby="confirm-approval-heading"
        aria-describedby="confirm-approval-description"
      >
        <ModalHeading id="confirm-approval-heading">
          Approve even though something does not match?
        </ModalHeading>
        <div className="usa-prose">
          <p id="confirm-approval-description">
            This label does not match the form on: <strong>{problemNames}</strong>.
            Approve it only if you have decided the difference is acceptable.
          </p>
        </div>
        <ModalFooter>
          <ButtonGroup>
            <ModalToggleButton
              modalRef={modalRef}
              closer
              type="button"
              onClick={() => {
                if (pendingApproval) onDecide("approved");
                setPendingApproval(false);
              }}
            >
              Yes, approve it
            </ModalToggleButton>
            <ModalToggleButton
              modalRef={modalRef}
              closer
              unstyled
              type="button"
              className="padding-105 text-center"
              onClick={() => {
                setPendingApproval(false);
              }}
            >
              Go back
            </ModalToggleButton>
          </ButtonGroup>
        </ModalFooter>
      </Modal>
    </div>
  );
}
