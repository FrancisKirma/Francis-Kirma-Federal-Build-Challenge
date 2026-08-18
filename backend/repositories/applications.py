"""Seeded applications standing in for a COLA fetch.

Each record is one simulated applicant submission: the form data they filed plus
the artwork they filed with it. The service reads the artwork itself and compares
what it read against ``submitted`` — so the queue served to the client must never
carry ``_label_truth``, which is the answer key.
"""

import json
from pathlib import Path
from typing import Any, Final

# The fixture data lives beside the backend package, not beside this module: it is
# seeded data standing in for a COLA fetch, not source.
_ROOT: Final = Path(__file__).resolve().parents[1] / "fixtures"

TRUTH_KEY: Final = "_label_truth"


def versions() -> list[str]:
    """Return all dated fixture sets, oldest first. ISO dates sort chronologically."""
    return sorted(
        d.name
        for d in _ROOT.iterdir()
        if d.is_dir() and (d / "applications.json").exists()
    )


def version_dir() -> Path:
    """Directory holding the newest applications.json and its labels/."""
    found = versions()
    if not found:
        msg = f"no dated fixture set found in {_ROOT}"
        raise FileNotFoundError(msg)
    return _ROOT / found[-1]


def current_version() -> str:
    """Return the dated fixture set in use."""
    return version_dir().name


def _records() -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = json.loads(
        (version_dir() / "applications.json").read_text()
    )
    return records


def pending_applications() -> list[dict[str, Any]]:
    """Return the queue as served, with truth keys stripped."""
    return [{k: v for k, v in r.items() if k != TRUTH_KEY} for r in _records()]


def label_path(application_id: str) -> Path:
    """Absolute path to one record's artwork."""
    for record in _records():
        if record["application_id"] == application_id:
            artwork: str = record["artwork"]
            return version_dir() / artwork
    msg = f"unknown application_id: {application_id}"
    raise KeyError(msg)


def label_truth(application_id: str) -> dict[str, Any]:
    """Ground truth for one record. Tests only — never serve this."""
    for record in _records():
        if record["application_id"] == application_id:
            truth: dict[str, Any] = record[TRUTH_KEY]
            return truth
    msg = f"unknown application_id: {application_id}"
    raise KeyError(msg)


def _self_check() -> None:
    queue = pending_applications()
    expected_records = 8
    assert len(queue) == expected_records, len(queue)

    # The one property worth a guard: the answer key must not leak into the queue.
    serialized = json.dumps(queue)
    assert TRUTH_KEY not in serialized
    assert "expected_status" not in serialized
    assert "TITLE_CASE" not in serialized

    first = queue[0]
    assert set(first) == {
        "application_id", "applicant", "submitted_date",
        "beverage_type", "artwork", "submitted",
    }, set(first)

    assert label_path("TTB-2024-0041").name == "ttb-2024-0041.png"
    assert label_path("TTB-2024-0041").parent.parent.name == current_version()
    assert current_version() in versions()
    assert label_truth("TTB-2024-0044")["printed"]["government_warning"] == "TITLE_CASE"

    for missing in ("nope", ""):
        try:
            label_path(missing)
        except KeyError:
            pass
        else:
            message = f"expected KeyError for {missing!r}"
            raise AssertionError(message)

    print("fixtures loader: OK")


if __name__ == "__main__":
    _self_check()
