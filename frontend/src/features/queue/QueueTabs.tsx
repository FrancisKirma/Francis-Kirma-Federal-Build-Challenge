import { Button, ButtonGroup } from "@trussworks/react-uswds";

export type QueueTab = "pending" | "approved" | "denied";

interface QueueTabsProps {
  active: QueueTab;
  counts: Record<QueueTab, number>;
  onChange: (tab: QueueTab) => void;
}

const TABS: { id: QueueTab; label: string }[] = [
  { id: "pending", label: "Waiting for review" },
  { id: "approved", label: "Approved" },
  { id: "denied", label: "Rejected" },
];

/**
 * USWDS 3 ships no tab component, so this is its segmented-button pattern:
 * real buttons carrying aria-pressed, which screen readers announce as a
 * selected state without inventing a widget role.
 */
export function QueueTabs({
  active,
  counts,
  onChange,
}: QueueTabsProps): React.ReactElement {
  return (
    <nav aria-label="Filter applications by decision" className="margin-bottom-3">
      <ButtonGroup type="segmented">
        {TABS.map((tab) => (
          <Button
            key={tab.id}
            type="button"
            outline={active !== tab.id}
            aria-pressed={active === tab.id}
            onClick={() => {
              onChange(tab.id);
            }}
          >
            {tab.label} ({counts[tab.id]})
          </Button>
        ))}
      </ButtonGroup>
    </nav>
  );
}
