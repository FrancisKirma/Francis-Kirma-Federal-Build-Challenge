# AGENTS.md — TTB Label Verification (POC)

Standing rules for this project. They apply to every response, not just the first.

## 1. Stack

- **Backend:** Python 3.13 + FastAPI
- **Frontend:** React + TypeScript. Stack is locked to TS/Node + Python 3.13 — no other languages.
- **Design system:** USWDS 3 via `@trussworks/react-uswds`, with `@uswds/uswds` as its peer. Components come from the library; we do not hand-roll a button, alert, file input, or table that USWDS already ships. Note it is community-maintained (Truss) — USWDS/GSA publish no official React library, so the *design standard* is authoritative, the wrapper is not.
- **Extraction:** a vision model
- **State:** none. No database. Stateless / in-memory only.
- **Deploy target:** Vercel (free tier). Backend as Python serverless functions under `api/`, frontend as static output. Anything that can't run on Vercel's serverless model (background workers, local disk writes, long-lived processes) is out.

## 2. Hard requirements — these override convenience

1. **Under 5 seconds** for a single-label result, end to end.
2. **Usable with no instructions by a non-technical 70+ user.** Big targets, plain words, obvious next step, visible errors. USWDS components are the default path to this — they carry the accessible markup, focus states, and target sizes already. Deviating from a USWDS pattern needs a stated reason.
   - Accessibility is not optional and not a polish phase: semantic markup, labelled controls, visible focus, and error text that says what to do next. Never simplified away.
3. **Batch upload is required**, not a stretch goal.
4. **Government warning: EXACT, case-sensitive match.** No trimming, no normalizing, no case folding, no fuzzy scoring. Every *other* field is fuzzy/normalized.
5. **API keys in environment variables only.** Never hardcoded, never committed, never in client-side code. `.env` stays gitignored.

If a requirement and a convenience collide, the requirement wins and the tradeoff gets stated in one line.

## 3. Working cadence

Three modes. Wait for the word before switching.

- **PLAN** — propose an approach, list the files to be touched and the risks. **Write no code.**
- **REVIEW** — critique that plan against the requirements above and against edge cases. Finalize it.
- **EXECUTE** — implement exactly the approved plan, with tests. Then say how to verify it.

Scope stays inside the current phase. No work from the next phase, no "while I was in there."

## 4. Type safety and testing — enforced, not aspirational

Every gate below runs in CI on push and PR. A red check blocks the merge; that is the whole point of having them.

### TypeScript
- `tsconfig.json` uses the strict block: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`.
- ESLint on `strictTypeChecked`.
- **No `any` outside `*.test.ts`.** Not in a cast, not in a generic parameter, not behind a `// eslint-disable`.
- Tests: vitest.

### Python
- mypy `strict = true`.
- Ruff `select = ["ALL"]`, ignoring only `D203` and `D213`. Tests waive `S101` so `assert` is usable.
- **No `# type: ignore` without a one-line justification on the same line.** Same for `# noqa` — name the rule and say why.
- Pydantic v2 for all runtime validation, including every request and response model.
- Tests: pytest, with `pythonpath` set in `pyproject.toml`.

### The test rule
**No merge without a paired failing-then-passing test.** Write the test, watch it fail for the right reason, then make it pass. CI cannot verify the "failed first" half — that part is on me, and I state in the EXECUTE writeup which test was written first and what its failure looked like.

CI blocks on suites passing. There is no coverage percentage gate; a green suite that tests nothing is caught in REVIEW, not by a number.

### CI workflow
`.github/workflows/ci.yml` runs, and blocks on: `tsc --noEmit`, `eslint`, `vitest`, `mypy`, `ruff check`, `pytest`. Nothing merges that fails any of the six.

## 5. Correctness over ambition

Prefer the boring, correct, clean structure. No speculative abstractions, no config for values that never change, no dependency for what a few lines do. Ship the smallest thing that satisfies §2 and passes §4.

## Verification

Anything with real logic — matching, normalization, batch handling — leaves one runnable check behind. Smallest thing that fails if the logic breaks.
