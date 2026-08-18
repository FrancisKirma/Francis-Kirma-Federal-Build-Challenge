

Readme · MD
# TTB Label Verification Prototype
 
A single-page tool for TTB compliance agents that removes manual transcription from label
review. The agent opens a pending application — claimed values and submitted artwork both
already on file — and within five seconds sees the claimed values beside what was extracted
from the image: brand, class/type, ABV, net contents, and government warning, each marked
match, mismatch, or unreadable. The agent still reviews every row and makes the call; the
tool never approves anything. Batch mode runs the same engine across a selected set of
pending applications, flagged rows first. It automates the reading, not the judgment.
 
---
 
## Interpreting the brief
 
The Technical Requirements section of the prompt is intentionally empty. The actual
requirements are distributed through the four interview transcripts, mixed with
context that is not actionable. This section documents what was extracted and what
was set aside, since those decisions drove the build.
 
### Requirements taken as binding
 
| Requirement | Source | How it shaped the build |
|---|---|---|
| Results in ~5 seconds | Sarah — the scanning vendor pilot failed at 30-40s and agents abandoned it | Single VLM call per label, downscaled image, capped output tokens. Batch runs concurrently and renders rows as they resolve so the per-label bar still holds. |
| Usable by non-technical agents | Sarah — half the team is over 50; "something my mother could figure out" | One screen, one primary action, no nested navigation, large hit targets, no hidden controls. |
| Batch upload | Sarah — importers submit 200-300 at once; Janet has requested it for years | Multi-select on the pending queue runs the same engine. Treated as a scored feature, not a stretch goal. |
| Warning statement must match exactly | Jenny — caught a rejection over `Government Warning` in title case | The warning is the one field compared with strict string equality after whitespace normalization. Casing differences fail. |
| Tolerance for benign text variation | Dave — `STONE'S THROW` vs `Stone's Throw` is "obviously the same thing" | Brand and class/type are normalized (case, punctuation, whitespace) before comparison. A normalized-equal pair passes; a near-but-not-equal pair is flagged for review rather than auto-failed. |
| Imperfect photography | Jenny — angled shots, bad lighting, glare on the bottle | Drove the choice of a vision model over classical OCR. Not separately engineered; it is a property of the extraction approach. |
| Standalone, no COLA integration | Marcus — COLA has its own authorization requirements, integration is "years away" | The pending queue is seeded from a local fixture standing in for a COLA fetch. This boundary is stated in the UI, not just here. |
| Nothing sensitive stored | Marcus — "just don't do anything crazy" | No persistence beyond the session. No auth. No PII in fixtures; applicant names are invented. |
 
### Context noted but not actionable
 
The FedRAMP timeline, the 2019 Azure migration, the $4.2M COLA rebuild quote, the 2008
phone system, and the .NET stack all describe the environment a future production system
would live in. None constrain a standalone prototype. Marcus's firewall note is a real
production risk — an agency network that blocked the previous vendor's ML endpoints would
block a third-party inference API too — but it constrains TTB's network, not this
deployment. It is recorded as a production risk below rather than designed around now.
 
### The design decision this drove
 
The agent does not type anything. An early reading of the brief suggests a form where the
agent enters the claimed values and uploads a label — but if the agent transcribes the ABV
in order to check the ABV, they have already read the label and the tool has saved nothing.
In the real workflow both halves already exist: the applicant submitted structured form data
and artwork together. The agent's job is to compare them and decide.
 
So the tool reports and the human rules. There is no auto-approval, and clean rows are not
hidden or skipped. TTB approval is a legal determination made by the agent, and a tool that
is easy to rubber-stamp is worse than no tool, because it launders a skipped check into a
recorded approval. Every field shows the claimed value beside the extracted value so that
confirming is a glance rather than an act of trust. What changes is where the effort goes:
mismatches get scrutiny, matches get a glance. A 5-10 minute review becomes 1-2 minutes.
 
---
 
## Scope
 
### In
 
- Pending queue seeded from fixtures, each row carrying claimed values and artwork
- Single-application review: open a record, extract, compare, display
- Five fields: brand name, class/type, alcohol content, net contents, government warning
- Three comparison strategies (normalized / numeric / exact) — see below
- Per-field status: match, mismatch, or unreadable
- Batch: multi-select from the queue, concurrent execution, flagged rows first
- Upload path for an arbitrary label image, so the reviewer can test something not in the fixtures
- Deployed and publicly reachable
### Out, and why
 
| Cut | Reason |
|---|---|
| Bounding-box highlighting of extracted text on the image | Reliable version needs word-level OCR coordinates fuzzy-matched to extracted values — roughly a third of the available time, and it inherits classical OCR's weakness on exactly the angled/glare images where a highlight would help most. Approach sketched in Future Work. |
| Font size and bold detection on the warning statement | **Known gap.** Jenny described three cheats: wrong wording, wrong capitalization, and burying it in tiny text. Text comparison catches the first two. The typographic check needs layout analysis and is not in this build. |
| COLA integration | Explicitly out of scope per Marcus. |
| Authentication, persistence, audit trail | Required for production, not for a proof-of-concept holding no sensitive data. |
| Beverage-type-specific rule sets | Requirements differ across beer, wine, and spirits. The prototype validates against distilled spirits fields only. |
 
---
 
## Fields extracted
 
The model returns one JSON object per label with exactly these keys. Any field it cannot
read is returned as `null` rather than guessed, which is what produces the `unreadable`
status downstream — a hallucinated value that happens to match the claim is the worst
possible failure for this tool.
 
| Field | JSON key | On the label | Comparison | Notes |
|---|---|---|---|---|
| Brand name | `brand_name` | Largest text, usually top third | Normalized | Often stylized or split across lines; extract as a single string. |
| Class/type | `class_type` | Beneath the brand | Normalized | The designation only (`Kentucky Straight Bourbon Whiskey`), excluding marketing copy on the same line. |
| Alcohol content | `alcohol_content` | Front or side, small type | Numeric | Return the string as printed; parsing happens in the comparison layer. Proof, where present, is ignored — ABV governs. |
| Net contents | `net_contents` | Bottom of front panel | Numeric | Both value and unit; `750 mL` and `700 mL` must not collapse. |
| Government warning | `government_warning` | Back or side panel, dense small type | Exact | Return the full statement verbatim, including the `GOVERNMENT WARNING:` prefix and original casing. Do not normalize or correct it — the comparison depends on receiving exactly what is printed. |
 
### Present on real labels, not extracted
 
The brief lists bottler name and address and country of origin among TTB's mandatory
elements. Both are omitted here. Neither appeared in the sample label fields, address
matching needs its own normalization rules to be meaningful, and country of origin only
applies to imports — so both would add comparison surface without exercising anything the
five chosen fields don't already cover. They are additional rows in the same table, not a
different problem.
 
---
 
## Comparison strategies
 
One matching function for all five fields fails in both directions — it either rejects
Dave's `STONE'S THROW` or accepts a title-case government warning. Fields are compared
by type:
 
**Normalized** (brand name, class/type) — lowercased, punctuation and extra whitespace
stripped, then compared. `STONE'S THROW` and `Stone's Throw` normalize equal and pass.
A pair that is close but not equal after normalization is surfaced as a mismatch for the
agent to judge, not silently accepted.
 
**Numeric** (alcohol content, net contents) — the number is parsed out of both strings and
compared as a value, so `45% Alc./Vol.` and `45.0% ABV` agree. Unit differences are real
mismatches: `750 mL` and `700 mL` fail.
 
**Exact** (government warning) — whitespace-normalized string equality against the
prescribed statutory text. Everything else fails, including capitalization. This is the
field where the machine outperforms the eye: it is boilerplate, humans skim it, and that
is exactly why applicants tamper with it.
 
---
 
## Fixture format
 
The pending queue stands in for a COLA fetch. Each record pairs the applicant's submitted
form data with the artwork submitted alongside it.
 
```json
[
  {
    "application_id": "TTB-2024-0041",
    "applicant": "Old Tom Distillery LLC",
    "submitted_date": "2024-03-11",
    "beverage_type": "distilled_spirits",
    "artwork": "labels/ttb-2024-0041.png",
    "claimed": {
      "brand_name": "OLD TOM DISTILLERY",
      "class_type": "Kentucky Straight Bourbon Whiskey",
      "alcohol_content": "45% Alc./Vol. (90 Proof)",
      "net_contents": "750 mL",
      "government_warning": true
    }
  },
  {
    "application_id": "TTB-2024-0042",
    "applicant": "Stone's Throw Spirits Co.",
    "submitted_date": "2024-03-11",
    "beverage_type": "distilled_spirits",
    "artwork": "labels/ttb-2024-0042.png",
    "claimed": {
      "brand_name": "Stone's Throw",
      "class_type": "Straight Rye Whiskey",
      "alcohol_content": "43% Alc./Vol. (86 Proof)",
      "net_contents": "750 mL",
      "government_warning": true
    }
  }
]
```
 
`government_warning` is a boolean on the application because that is how the applicant
attests to it — the form asks whether the statement is present, and the label carries the
text. The tool compares that attestation against the actual statutory text found on the
artwork.
 
### Fixture design
 
Fixtures generated *from* their labels would all pass, and a reviewer clicking through a
queue of green rows learns nothing about whether the comparison logic works. The set is
therefore built with deliberate divergences:
 
| ID | Condition | Expected result |
|---|---|---|
| 0041 | Clean | All match |
| 0042 | Label reads `STONE'S THROW`, application reads `Stone's Throw` | Match — normalization absorbs it |
| 0043 | Application says 45%, label printed 43% after a batch change | Mismatch on alcohol content |
| 0044 | Warning present but set in title case | Mismatch on government warning |
| 0045 | European fill — application says 750 mL, label says 700 mL | Mismatch on net contents |
| 0046 | Class/type shortened to `Kentucky Bourbon` on the label | Mismatch on class/type |
| 0047 | Photographed at an angle under poor lighting, otherwise clean | All match — exercises the vision model |
| 0048 | Warning statement absent entirely | Unreadable / not found |
 
### Generating the test labels
 
Labels are **composed, not image-generated.** An image model cannot reliably render the
~60-word statutory warning verbatim — it garbles long text — and a fixture whose warning is
subtly wrong makes every failure ambiguous between "the tool works" and "the test data is
broken." Composing gives exact control over every string, which is the whole point when the
warning is compared byte-for-byte.
 
1. **Build one label template** as HTML/CSS sized to a 750ml front-and-back panel, with each
   field in a slot. Render to PNG with a headless browser. (PIL works too; HTML is faster to
   iterate on typography.)
2. **Drive it from the fixture file.** Read `applications.json`, render one image per record,
   write to `fixtures/labels/`. Each broken variant is then a one-line change plus a
   re-render rather than a new asset — 0044's title-case warning is a `text-transform`
   toggle, 0045 is `700 mL`.
3. **Introduce the divergences deliberately** by rendering from a separate `actual` block in
   the generator input, distinct from `claimed`. Where the two blocks agree the row is
   clean; where they differ you have a known-answer test. This also gives you the expected
   result table above for free, which is what makes the comparison engine testable.
4. **Vary the visual style** across records — different fonts, colors, panel layouts — so the
   extraction isn't being exercised against one template it could trivially memorize.
5. **Produce 0047 by transforming a clean render**: perspective-warp, dim, and overlay a
   specular highlight on 0041's output. Post-processing a known-good label keeps the ground
   truth exact while still testing the vision path. Tune the distortion down until it passes
   reliably — a fixture that fails intermittently reads as a bug during a demo, not as
   robustness.
6. **Optionally add one photographed real bottle** as a sanity check that the pipeline works
   on something that didn't come out of the same generator.
Keep the generator script in the repo. It documents the test data, makes the divergences
auditable, and lets a reviewer regenerate or extend the fixture set.
 
---
 
## Service structure
 
```
.
├── backend/
│   ├── main.py               # FastAPI app; serves the built frontend as static files
│   ├── routes.py             # /api/applications, /api/verify, /api/verify/batch
│   ├── extraction.py         # VLM call, strict-JSON prompt, Pydantic validation, one retry
│   ├── comparison.py         # normalized / numeric / exact strategies, pure functions
│   ├── models.py             # Application, ClaimedFields, ExtractedFields, FieldResult
│   ├── warning_text.py       # canonical statutory warning text
│   └── fixtures/
│       ├── applications.json
│       └── labels/
├── tools/
│   ├── generate_labels.py    # renders fixtures/labels/ from claimed + actual blocks
│   └── label_template.html
├── frontend/
│   └── src/
│       ├── Queue.jsx         # pending applications, thumbnails, multi-select
│       ├── Review.jsx        # single application, results table, full artwork
│       ├── BatchResults.jsx  # grid, flagged rows first, rows render as they resolve
│       └── ResultRow.jsx     # claimed | extracted | status
└── tests/
    └── test_comparison.py    # comparison engine against hand-written extraction JSON
```
 
Single deployable unit: FastAPI serves the built React bundle, so there is one target,
no CORS configuration, and no second service to keep running.
 
`comparison.py` holds no model dependency and is fully unit-testable against hand-written
extraction dictionaries, which is why it is built and tested before the extraction layer
is wired up.
 
### Endpoints
 
| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/applications` | Pending queue |
| `POST` | `/api/verify/{application_id}` | Extract and compare one application |
| `POST` | `/api/verify/batch` | Same, over a list of IDs, bounded concurrency |
| `POST` | `/api/verify/upload` | Ad-hoc image, no application record |
 
---
 
## Setup
 
_To be completed._
 
## Trade-offs and limitations
 
- **Typographic compliance is not checked.** See the cut list. The warning's wording and
  capitalization are verified; its rendered size and weight are not.
- **Extraction is probabilistic.** The vision model can misread a field. This is why no
  row is auto-approved and why the extracted value is always shown beside the claimed one —
  a wrong extraction should be visible to the agent, not silently recorded.
- **Distilled spirits only.** Beer and wine have different mandatory fields.
- **Production network risk.** Marcus reported that the agency firewall blocked the previous
  vendor's ML endpoints. A production deployment would need either an allowlisted endpoint
  or in-boundary inference; this prototype assumes ordinary outbound access.
- **No audit trail.** A production tool would need to record what the model extracted and
  what the agent decided, for both compliance and model-drift monitoring.
## Future work
 
- **Region highlighting.** Word-level coordinates from an OCR pass, fuzzy-matched against
  each extracted value, drawn as a rectangle over the artwork. Makes confirming a clean row
  a one-second glance instead of a scan of the whole label.
- **Typographic verification** of the warning statement — relative font size and weight.
- **Confidence surfacing**, separating "the model was unsure" from "the values disagree."
  Those call for different agent actions.
- **Queue prioritisation**, ordering likely-problem applications first. Not omission —
  every application is still reviewed.
 

