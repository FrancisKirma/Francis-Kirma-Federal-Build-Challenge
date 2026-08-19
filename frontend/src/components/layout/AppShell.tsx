import { GovBanner, GridContainer, Header, Title } from "@trussworks/react-uswds";

import styles from "./AppShell.module.scss";

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
      {/* The banner states this is an official government website, which a
          prototype cannot claim. The pill sits inside the same statement so the
          qualification is read with it rather than after it. */}
      <div className={styles.bannerRow}>
        <GovBanner />
        <span className={styles.demoPill}>Demo only — not a government site</span>
      </div>
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
                Prototype with sample applications. The first label you check may
                take a few seconds longer than the rest.
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
