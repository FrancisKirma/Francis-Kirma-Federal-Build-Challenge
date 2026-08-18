import { GovBanner, GridContainer, Header, Title } from "@trussworks/react-uswds";

/** The government-standard page frame: banner, header, and one content column. */
export function AppShell({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <>
      {/* Lets a keyboard or screen reader user reach the work without walking
          the banner and header on every view. react-uswds ships no SkipNav in
          v12, so this is USWDS's own markup. */}
      <a className="usa-skipnav" href="#main-content">
        Skip to the applications
      </a>
      <GovBanner />
      <Header basic>
        <div className="usa-nav-container">
          <div className="usa-navbar">
            {/* The page's only h1: every view is a section of this one tool. */}
            <Title>
              <h1 className="font-heading-lg margin-0">TTB Label Verification</h1>
            </Title>
          </div>
        </div>
      </Header>
      <GridContainer className="margin-y-4">
        <main id="main-content">{children}</main>
      </GridContainer>
    </>
  );
}
