import { Alert, AlertHeading, AlertText } from "@trussworks/react-uswds";

interface StatusAlertProps {
  type: "info" | "error" | "warning" | "success";
  heading: string;
  children: React.ReactNode;
  /** Extra content below the message, such as a retry button. */
  action?: React.ReactNode;
}

export function StatusAlert({
  type,
  heading,
  children,
  action,
}: StatusAlertProps): React.ReactElement {
  return (
    <Alert type={type}>
      <AlertHeading level="h3">{heading}</AlertHeading>
      <AlertText>{children}</AlertText>
      {action !== undefined && <div className="margin-top-2">{action}</div>}
    </Alert>
  );
}
