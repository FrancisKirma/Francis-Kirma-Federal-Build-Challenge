## 2026-08-18 — Review UI: streaming results and narrowed USWDS assets

**Asked:** Build the React frontend on USWDS — pending queue, single review
screen with the artwork beside the comparison table, batch run, and ad-hoc
upload — against the existing API.

**Produced:** A Vite/React app using `@trussworks/react-uswds`. The batch feature
called `POST /api/verify/batch` and awaited the whole run, status was conveyed by
tag colour, error alerts surfaced the HTTP status, and the USWDS `dist/` assets
were vendored into `public/` wholesale.

**Accepted / Rejected:** Accepted the component layout and the USWDS component
library. REJECTED the `/verify/batch` call for the UI — `useBatchVerification`
issues one request per label at `CONCURRENCY = 4` so rows resolve as they land.
REJECTED colour-only status: `StatusTag` pairs every colour with words. REJECTED
status codes in alerts; `toApiError` maps each one to what to do next. REJECTED
the wholesale vendoring for `scripts/copy-uswds-assets.mjs`, with `public/`
gitignored as generated.

**Why:** Awaiting the batch hides the per-label speed behind the slowest label and
lets one failure blank the whole run — streaming keeps both visible, and the batch
endpoint stays for API consumers. Colour alone fails colour-blind reviewers and
Section 508, and an HTTP status tells a reviewer nothing they can act on. The
asset script cut 15 MB of unused fonts and images from the repo, and names the one
deliberate exclusion (`hero.jpg`) so a future Hero component is not a mystery.
