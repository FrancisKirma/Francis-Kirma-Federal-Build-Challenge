import { GovBanner, GridContainer, Header, Title } from "@trussworks/react-uswds";

/** The government-standard page frame: banner, header, and one content column. */
export function AppShell({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <>
      <GovBanner />
      <Header basic>
        <div className="usa-nav-container">
          <div className="usa-navbar">
            <Title>TTB Label Verification</Title>
          </div>
        </div>
      </Header>
      <GridContainer className="margin-y-4">
        <main id="main-content">{children}</main>
      </GridContainer>
    </>
  );
}
