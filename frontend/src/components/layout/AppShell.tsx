import {
  GovBanner,
  GridContainer,
  Header,
  SiteAlert,
  Title,
} from "@trussworks/react-uswds";

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
      {/* The banner below states this is an official government website, which
          is a claim a prototype cannot make. This says plainly what it is,
          above the banner rather than by altering it: the banner is a federal
          standard and is not ours to reword. */}
      <SiteAlert variant="info" slim showIcon={false} heading="Demonstration only">
        A proof of concept for evaluation. Not an official TTB system, and no
        decision recorded here has any legal effect.
      </SiteAlert>
      <GovBanner />
      <Header basic>
        <div className="usa-nav-container">
          <div className="usa-navbar">
            {/* The page's only h1: every view is a section of this one tool. */}
            <Title>
              <h1 className="font-heading-lg margin-0">TTB Label Verification</h1>
              {/* The service sleeps when idle, so the first check of a session
                  pays a start-up cost the rest do not. Saying so beforehand
                  turns an unexplained wait into an expected one. */}
              <p className="font-body-xs text-base-dark margin-y-0 text-normal">
                The first label you check may take a few seconds longer than the
                rest.
              </p>
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
