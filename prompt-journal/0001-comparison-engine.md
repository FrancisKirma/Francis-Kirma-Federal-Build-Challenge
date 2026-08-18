## 2026-08-18 — Fixture checker sharing the real comparison engine

**Asked:** Add a comparison engine (`backend/comparison.py`) with the three
strategies the README describes, then wire `check_fixtures.py` to verify the
fixture set's `expected_status` against it.

**Produced:** `comparison.py` with `normalize`, `parse_measure`, and per-type
status functions. `check_fixtures.py` kept its own local copies of `normalize`
and `parse_measure`, and its `derive()` compared against those.

**Accepted / Rejected:** Accepted `comparison.py`. REJECTED the local copies —
`check_fixtures.py` now imports `normalize` and `parse_measure` from
`comparison`. Also rejected the fluid-ounce → mL conversion in `_TO_ML` and left
ounces comparing only to ounces.

**Why:** Two implementations of the same rule drift, and the one that drifts
silently is the checker — it would keep passing while the shipped engine was
wrong. The checker has to exercise the real code path to be worth running. The
oz conversion was rejected because 25.4 oz is 751.1 mL, so the same bottle would
read as a numeric near-miss and surface as a false mismatch.
