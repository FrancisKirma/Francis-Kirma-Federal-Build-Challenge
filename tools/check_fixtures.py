"""Validate applications.json against itself.

Every record declares an ``expected_status`` per field. That table is only useful if
it actually follows from the claimed/actual divergence, so derive it here and compare.
This is the known-answer test the comparison engine will later be graded against.

Run: python backend/fixtures/check_fixtures.py
"""

import json
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from constants import STATUTORY_WARNING, WARNING_VARIANTS
from repositories.applications import version_dir
from services.comparison import normalize, parse_measure

FIXTURES = version_dir() / "applications.json"
NORMALIZED_FIELDS = ("brand_name", "class_type")
NUMERIC_FIELDS = ("alcohol_content", "net_contents")

# 27 CFR 5.143: spirits are bottled at not less than 40% alcohol by volume.
MIN_ABV = 40.0


def derive(claimed: dict[str, Any], actual: dict[str, Any]) -> dict[str, str]:
    """Compute the status each field should get.

    Uses the shipped strategies from comparison.py rather than a local copy, so
    this stays a check on the real engine instead of drifting into a second
    implementation that can silently disagree with it.
    """
    status: dict[str, str] = {}

    for field in NORMALIZED_FIELDS:
        claim, act = str(claimed[field]), str(actual[field])
        status[field] = "match" if normalize(claim) == normalize(act) else "mismatch"

    for field in NUMERIC_FIELDS:
        claim_m = parse_measure(str(claimed[field]))
        act_m = parse_measure(str(actual[field]))
        if claim_m is None or act_m is None:
            status[field] = "unreadable"
        else:
            status[field] = "match" if claim_m == act_m else "mismatch"

    printed = WARNING_VARIANTS[str(actual["government_warning"])]
    if printed is None:
        status["government_warning"] = "unreadable"
    else:
        # Exact, case-sensitive. No folding of any kind.
        status["government_warning"] = (
            "match" if printed == STATUTORY_WARNING else "mismatch"
        )

    return status


def _check_record(record: dict[str, Any], missing_art: list[str]) -> list[str]:
    """Return every inconsistency found in one record."""
    failures: list[str] = []
    app_id = str(record["application_id"])
    claimed = record["submitted"]
    actual = record["_label_truth"]["printed"]

    if claimed.keys() != actual.keys():
        return [f"{app_id}: submitted/printed key sets differ"]

    # Applicants attest the warning is present; that attestation is always a bool.
    if claimed["government_warning"] is not True:
        failures.append(f"{app_id}: submitted.government_warning must be true")

    # 27 CFR 5.143: spirits bottled at not less than 40% ABV.
    abv = parse_measure(str(actual["alcohol_content"]))
    if abv is not None and abv[0] < MIN_ABV:
        failures.append(f"{app_id}: actual ABV {abv[0]}% is below the 40% minimum")

    artwork = FIXTURES.parent / str(record["artwork"])
    if artwork.suffix != ".png" or not artwork.is_relative_to(FIXTURES.parent):
        failures.append(
            f"{app_id}: artwork {record['artwork']!r} is not a .png under fixtures/"
        )
    if not artwork.exists():
        missing_art.append(app_id)

    expected = record["_label_truth"]["expected_status"]
    if expected is None:
        # A deliberately degraded image: what a model returns from it cannot be
        # derived from the printed values, so there is no known answer to check.
        return failures
    got = derive(claimed, actual)
    failures.extend(
        f"{app_id}.{field}: fixture claims {want!r}, divergence yields {got[field]!r}"
        for field, want in expected.items()
        if got[field] != want
    )
    return failures


def main() -> int:
    """Verify every record against its own declared expectations."""
    records: list[dict[str, Any]] = json.loads(FIXTURES.read_text())
    failures: list[str] = []
    missing_art: list[str] = []

    seen_ids = [r["application_id"] for r in records]
    failures.extend(
        f"{app_id}: duplicate application_id"
        for app_id in seen_ids
        if seen_ids.count(app_id) > 1
    )

    for record in records:
        failures.extend(_check_record(record, missing_art))

    # The set is worthless if every row is green; confirm it exercises each status.
    all_expected = [
        s
        for r in records
        if r["_label_truth"]["expected_status"] is not None
        for s in r["_label_truth"]["expected_status"].values()
    ]
    failures.extend(
        f"fixture set never exercises {status!r}"
        for status in ("match", "mismatch", "unreadable")
        if status not in all_expected
    )

    # Images are generated in a later phase; absence is expected, silence is not.
    if missing_art:
        print(f"note: {len(missing_art)}/{len(records)} label images not yet rendered")

    if failures:
        print(f"FAIL ({len(failures)}):")
        for line in failures:
            print(f"  - {line}")
        return 1

    print(
        f"fixtures: OK — {FIXTURES.parent.name}, "
        f"{len(records)} records, {len(all_expected)} field expectations"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
