"""Validate applications.json against itself.

Every record declares an ``expected_status`` per field. That table is only useful if
it actually follows from the claimed/actual divergence, so derive it here and compare.
This is the known-answer test the comparison engine will later be graded against.

Run: python backend/fixtures/check_fixtures.py
"""

import json
import re
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from warning_text import STATUTORY_WARNING, WARNING_VARIANTS  # noqa: E402

from fixtures import version_dir  # noqa: E402  (path set above)

FIXTURES = version_dir() / "applications.json"
NORMALIZED_FIELDS = ("brand_name", "class_type")
NUMERIC_FIELDS = ("alcohol_content", "net_contents")


def normalize(value: str) -> str:
    """Lowercase, fold punctuation and collapse whitespace, per the normalized strategy."""
    folded = unicodedata.normalize("NFKD", value).lower()
    folded = folded.replace("’", "'")
    folded = re.sub(r"[^\w\s]", "", folded)
    return re.sub(r"\s+", " ", folded).strip()


def parse_measure(value: str) -> tuple[float, str] | None:
    """Pull the leading number and its unit out of a printed measurement."""
    match = re.search(r"(\d+(?:\.\d+)?)\s*(%|ml|l|oz)?", value.lower())
    if match is None:
        return None
    unit = match.group(2) or "%"
    return float(match.group(1)), unit


def derive(claimed: dict[str, object], actual: dict[str, object]) -> dict[str, str]:
    """Compute the status each field should get, using the three README strategies."""
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


def main() -> int:
    records = json.loads(FIXTURES.read_text())
    failures: list[str] = []
    missing_art: list[str] = []
    seen_ids: set[str] = set()

    for record in records:
        app_id = record["application_id"]
        if app_id in seen_ids:
            failures.append(f"{app_id}: duplicate application_id")
        seen_ids.add(app_id)

        claimed = record["submitted"]
        actual = record["_label_truth"]["printed"]
        if claimed.keys() != actual.keys():
            failures.append(f"{app_id}: submitted/printed key sets differ")
            continue

        # Applicants attest the warning is present; that attestation is always a bool.
        if claimed["government_warning"] is not True:
            failures.append(f"{app_id}: submitted.government_warning must be true")

        # 27 CFR 5.143: spirits bottled at not less than 40% ABV.
        abv = parse_measure(str(actual["alcohol_content"]))
        if abv is not None and abv[0] < 40:
            failures.append(f"{app_id}: actual ABV {abv[0]}% is below the 40% minimum")

        artwork = FIXTURES.parent / record["artwork"]
        if artwork.suffix != ".png" or not artwork.is_relative_to(FIXTURES.parent):
            failures.append(f"{app_id}: artwork path {record['artwork']!r} is not a .png under fixtures/")
        missing_art.append(app_id) if not artwork.exists() else None

        expected = record["_label_truth"]["expected_status"]
        got = derive(claimed, actual)
        for field, want in expected.items():
            if got[field] != want:
                failures.append(
                    f"{app_id}.{field}: fixture claims {want!r}, divergence yields {got[field]!r}"
                )

    # The set is worthless if every row is green; confirm it exercises each status.
    all_expected = [
        s for r in records for s in r["_label_truth"]["expected_status"].values()
    ]
    for status in ("match", "mismatch", "unreadable"):
        if status not in all_expected:
            failures.append(f"fixture set never exercises {status!r}")

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
