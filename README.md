

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
{
  "application_id": "TTB-2024-0041",
  "applicant": "Old Tom Distillery LLC",
  "submitted_date": "2024-03-11",
  "beverage_type": "distilled_spirits",
  "artwork": "labels/ttb-2024-0041.png",
  "submitted": {
    "brand_name": "OLD TOM DISTILLERY",
    "class_type": "Kentucky Straight Bourbon Whiskey",
    "alcohol_content": "45% Alc./Vol. (90 Proof)",
    "net_contents": "750 mL",
    "government_warning": true
  },
  "_label_truth": {
    "note": "What gets printed on the artwork. Never served to the client.",
    "condition": "Clean baseline.",
    "style": "serif-cream",
    "printed": {
      "brand_name": "OLD TOM DISTILLERY",
      "class_type": "Kentucky Straight Bourbon Whiskey",
      "alcohol_content": "45% Alc./Vol. (90 Proof)",
      "net_contents": "750 mL",
      "government_warning": "STATUTORY"
    },
    "expected_status": {
      "brand_name": "match",
      "class_type": "match",
      "alcohol_content": "match",
      "net_contents": "match",
      "government_warning": "match"
    }
  }
}
```

`submitted` is the whole served record — the applicant's form data and the artwork they
filed with it. `_label_truth` is not submitted by anyone: it is renderer input and the
known-answer key, and `pending_applications()` strips it before serving. If the queue
handed over what is printed on the label, the service could "pass" by echoing it back and
the comparison engine would be untested.

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
 
1. **One HTML/CSS template**, `tools/label_template.html`, sized to a single 600×800 front
   panel with each field in a slot. Rendered to PNG by headless Chrome — already installed,
   so no Playwright download and no new dependency for what a subprocess call does.
2. **Driven by the fixture file.** `tools/generate_labels.py` reads the active
   `applications.json` and renders one image per record. A broken variant is a one-line data
   change plus a re-render, not a new asset.
3. **Divergences come from a separate `_label_truth.printed` block**, distinct from
   `submitted`. Where the two agree the row is clean; where they differ there is a
   known-answer test. That block is what makes the comparison engine testable, and it is
   never served to the client — the queue loader strips it.
4. **Six visual styles** across the eight records — Baskerville, Futura, Didot, Optima,
   Bodoni, Copperplate, on light and dark grounds — so extraction is not exercised against
   one template it could memorise.
5. **0047 is a clean render transformed**: 8° perspective rotation, dimmed, with a specular
   highlight and directional falloff. The highlight is positioned away from the warning
   panel and the distortion kept mild deliberately — that record expects every field to
   match, including the byte-for-byte warning, so distortion severe enough to flake would
   read as a tool bug rather than as robustness.
6. **No photographed real bottle yet.** Noted in Future Work as a sanity check that the
   pipeline is not overfit to the generator.

The generator stays in the repo but is **not** a build step: it is run by hand and the PNGs
are committed. Rendering during a build would need a browser in the deploy pipeline and
would let a font substitution silently change what the model sees while the known-answer
table still claimed the old result.

Fixture sets are **versioned by date**. A dated folder holds its `applications.json`
alongside the `labels/` rendered from it, so the data and the artwork stay together as a
consistent set; the newest dated folder is the active one.
 
---
 
## Service structure
 
```
.
├── backend/
│   ├── comparison.py         # normalized / numeric / exact strategies, pure functions
│   ├── models.py             # Pydantic v2: ClaimedFields, ExtractedFields, FieldResult
│   ├── warning_text.py       # canonical statutory warning text, 27 CFR 16.21
│   └── fixtures/
│       ├── __init__.py       # queue loader; strips the answer key before serving
│       ├── check_fixtures.py # validates each record against its own expectations
│       └── 2026-08-18/
│           ├── applications.json
│           └── labels/       # eight rendered PNGs
├── tools/
│   ├── generate_labels.py    # renders labels/ from _label_truth.printed
│   └── label_template.html
├── tests/
│   └── test_comparison.py    # 50 tests; fixture table plus hand-written edge cases
├── .github/workflows/ci.yml  # tsc, eslint, vitest, mypy, ruff, pytest
├── AGENTS.md                 # standing rules for the build
└── pyproject.toml            # deps, mypy strict, ruff ALL, pytest config
```

Not yet built: `extraction.py` (VLM call), the FastAPI app and routes, and the React
frontend. The order is deliberate — `comparison.py` holds no model dependency and is fully
unit-testable against hand-written extraction dictionaries, so it is built and tested
before the extraction layer is wired up.
 
Deployment target is Vercel: the Python backend runs as serverless functions and the React
bundle is served as static output, so there is one target and no second service to keep
running.
 
### Endpoints
 
| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/applications` | Pending queue |
| `POST` | `/api/verify/{application_id}` | Extract and compare one application |
| `POST` | `/api/verify/batch` | Same, over a list of IDs, bounded concurrency |
| `POST` | `/api/verify/upload` | Ad-hoc image, no application record |
 
---
 
## Setup

Requires Python 3.13 and [uv](https://docs.astral.sh/uv/). Chrome is needed only to
regenerate label artwork; the rendered PNGs are committed.

```bash
uv sync                                        # install dependencies
uv run pytest -q                               # 50 tests
uv run mypy .                                  # strict type check
uv run ruff check .                            # lint
```

Fixture and data checks:

```bash
uv run python backend/fixtures/check_fixtures.py   # each record vs its expectations
uv run python backend/fixtures/__init__.py         # loader, and the answer-key guard
uv run python backend/warning_text.py              # statutory text invariants
```

Regenerating label artwork (only needed after editing `_label_truth.printed`):

```bash
uv run python tools/generate_labels.py                       # all eight
uv run python tools/generate_labels.py --only TTB-2024-0044  # one
CHROME=/path/to/chrome uv run python tools/generate_labels.py
```

### Quality gates

`mypy --strict`, `ruff` with `select = ["ALL"]`, and pytest all run in CI and block a
merge. The government warning's exact-match behaviour is mutation-tested: making the
comparison case-insensitive, parsing proof instead of ABV, dropping unit conversion, or
treating a blank reading as a mismatch each break the suite.
 
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
- **Composed labels, not real artwork.** The fixtures are generated, so they are cleaner and
  more uniform than a real COLA submission — no foil, no curved bottle wrap, no dense back
  panel. Real artwork is the honest next test set, but it carries no known-answer key
  without someone transcribing each label by hand.
- **Single front panel.** Real submissions are front, back, and neck, and the warning
  genuinely lives on the back. Composing one panel keeps every field in one image and keeps
  the ground truth exact; multi-panel is a production concern.
- **Fluid ounces are not converted.** Volumes normalise to millilitres, so `0.75 L` and
  `750 mL` agree. `25.4 oz` is 751.1 mL — the same bottle at a different number — so
  converting would turn a labelling equivalence into a numeric near-miss. Ounces compare
  only against ounces; cross-unit matching would need a tolerance band.
- **Fixture data and artwork can drift.** They are versioned together by date, but nothing
  detects a `_label_truth.printed` edit made without a re-render. A hash manifest per dated
  folder would catch it.

## Future work
 
- **Region highlighting.** Word-level coordinates from an OCR pass, fuzzy-matched against
  each extracted value, drawn as a rectangle over the artwork. Makes confirming a clean row
  a one-second glance instead of a scan of the whole label.
- **Typographic verification** of the warning statement — relative font size and weight.
- **Confidence surfacing**, separating "the model was unsure" from "the values disagree."
  Those call for different agent actions.
- **Queue prioritisation**, ordering likely-problem applications first. Not omission —
  every application is still reviewed.
- **Real COLA artwork.** The Public COLA Registry holds approved label images back to 1999.
  It has no bulk export — per-record lookup by TTB ID only — so a sample would be assembled
  by hand, and each would need its fields transcribed to serve as a known-answer test.
 

