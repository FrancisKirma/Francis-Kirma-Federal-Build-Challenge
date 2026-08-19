"""Extraction tests.

The cassettes in ``tests/cassettes/`` are real responses from the vision model,
recorded once by ``tools/record_cassettes.py``. Replaying them keeps the suite
offline, deterministic, and free, while still asserting against what the model
actually returned rather than against a hand-written guess at it.

The end-to-end test is the payoff for the fixture work: real extraction fed
through the real comparison engine must reproduce each record's declared
``expected_status``.
"""

import json
import sys
from io import BytesIO
from pathlib import Path
from typing import Any

import pytest
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from constants import STATUTORY_WARNING, WARNING_VARIANTS
from models import FIELD_ORDER, ExtractedFields
from repositories.applications import label_path, pending_applications, version_dir
from services.comparison import compare_record
from services.extraction import (
    MAX_IMAGE_EDGE,
    PROVIDERS,
    SCHEMA,
    TIMEOUT_SECONDS,
    ExtractionError,
    InvalidImageError,
    extract,
    preprocess,
)

CASSETTES = Path(__file__).parent / "cassettes"
BUDGET_SECONDS = 5.0


def _cassette(application_id: str) -> dict[str, Any]:
    text = (CASSETTES / f"{application_id}.json").read_text()
    payload: dict[str, Any] = json.loads(text)
    return payload


def _records() -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = json.loads(
        (version_dir() / "applications.json").read_text()
    )
    return records


IDS = [r["application_id"] for r in _records()]


# --- Cassettes are complete and usable -------------------------------------

def test_every_fixture_has_a_cassette() -> None:
    """A missing cassette silently drops a record from the end-to-end test."""
    recorded = {p.stem for p in CASSETTES.glob("*.json")}
    assert recorded == set(IDS)


@pytest.mark.parametrize("application_id", IDS)
def test_cassette_parses_as_extracted_fields(application_id: str) -> None:
    fields = ExtractedFields.model_validate(_cassette(application_id)["response"])
    assert set(fields.model_dump()) == set(FIELD_ORDER)


# --- What the model actually did with the warning --------------------------

@pytest.mark.parametrize("application_id", IDS)
def test_warning_transcribed_verbatim(application_id: str) -> None:
    """Check the model transcribes whatever is printed, without tidying it.

    The exact-match comparison is meaningless if the model normalises. Whatever
    the label carries -- statutory text, title case, or nothing -- must come back
    exactly, including the casing that is the whole point of 0044.
    """
    record = next(r for r in _records() if r["application_id"] == application_id)
    expected = WARNING_VARIANTS[record["_label_truth"]["printed"]["government_warning"]]
    got = _cassette(application_id)["response"]["government_warning"]
    assert got == expected


def test_absent_warning_is_null_not_invented() -> None:
    """Check an absent warning comes back null rather than recalled.

    A model that reproduces the statute from memory here is the worst failure
    this tool has: a hallucinated match on the field that matters most.
    """
    got = _cassette("TTB-2024-0048")["response"]["government_warning"]
    assert got is None
    assert got != STATUTORY_WARNING


def test_title_case_warning_not_corrected() -> None:
    """Check a miscased warning is not silently repaired.

    0044's warning is worded correctly but cased wrongly, and repairing it would
    hide the exact tampering this field exists to catch.
    """
    got = _cassette("TTB-2024-0044")["response"]["government_warning"]
    assert got == WARNING_VARIANTS["TITLE_CASE"]
    assert got != STATUTORY_WARNING


# --- End to end: real extraction through the real comparison engine ---------

@pytest.mark.parametrize("application_id", IDS)
def test_recorded_extraction_reproduces_expected_status(application_id: str) -> None:
    record = next(r for r in _records() if r["application_id"] == application_id)
    result = compare_record(
        record["submitted"], _cassette(application_id)["response"], application_id
    )
    got = {field.field: field.status for field in result.fields}
    assert got == record["_label_truth"]["expected_status"]


def test_flagged_records_are_exactly_the_divergent_ones() -> None:
    flagged = set()
    for record in _records():
        app_id = record["application_id"]
        result = compare_record(
            record["submitted"], _cassette(app_id)["response"], app_id
        )
        if result.flagged:
            flagged.add(app_id)
    expected = {
        r["application_id"]
        for r in _records()
        if any(s != "match" for s in r["_label_truth"]["expected_status"].values())
    }
    assert flagged == expected


# --- Latency ---------------------------------------------------------------

@pytest.mark.parametrize("application_id", IDS)
def test_recorded_latency_within_budget(application_id: str) -> None:
    """Recorded timings are evidence the budget held, not a live guarantee."""
    assert _cassette(application_id)["elapsed_seconds"] < BUDGET_SECONDS


def test_provider_timeout_covers_a_cold_start() -> None:
    """The budget must survive the first call after the function goes cold.

    A warm call takes ~2.4s on the deployment and a cold one 1.5-2s more. A
    timeout tuned to warm calls fails the first review of every session, which
    is the worst one to fail.
    """
    assert TIMEOUT_SECONDS >= BUDGET_SECONDS + 2.5


# --- Image preprocessing (a trust boundary) --------------------------------

def test_preprocess_rejects_empty_bytes() -> None:
    with pytest.raises(InvalidImageError):
        preprocess(b"")


def test_preprocess_rejects_non_image() -> None:
    with pytest.raises(InvalidImageError):
        preprocess(b"this is not an image, it is a prompt injection attempt")


def test_preprocess_rejects_oversized_upload() -> None:
    with pytest.raises(InvalidImageError):
        preprocess(b"\x89PNG\r\n\x1a\n" + b"\x00" * (21 * 1024 * 1024))


def test_preprocess_produces_jpeg_within_edge_limit() -> None:
    out = preprocess(label_path("TTB-2024-0041").read_bytes())
    with Image.open(BytesIO(out)) as image:
        assert image.format == "JPEG"
        assert max(image.size) <= MAX_IMAGE_EDGE


def test_fixture_labels_are_not_downscaled() -> None:
    """Check the fixture labels pass through preprocessing at full size.

    Shrinking them below ~1024px makes the 11px warning unreadable and the model
    correctly returns null, turning a clean record into a false
    'unreadable'. Measured, not assumed -- see MAX_IMAGE_EDGE.
    """
    for application_id in IDS:
        with Image.open(BytesIO(label_path(application_id).read_bytes())) as original:
            original_edge = max(original.size)
        processed = preprocess(label_path(application_id).read_bytes())
        with Image.open(BytesIO(processed)) as out:
            assert max(out.size) == original_edge


# --- Provider selection ----------------------------------------------------

async def test_unknown_provider_is_rejected() -> None:
    with pytest.raises(ExtractionError, match="unknown AI_PROVIDER"):
        await extract(label_path("TTB-2024-0041").read_bytes(), provider="nope")


async def test_missing_key_fails_with_a_usable_message(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    with pytest.raises(ExtractionError, match="OPENAI_API_KEY is not set"):
        await extract(label_path("TTB-2024-0041").read_bytes(), provider="openai")


def test_both_providers_registered() -> None:
    assert set(PROVIDERS) == {"openai", "anthropic"}


def test_schema_allows_null_for_every_field() -> None:
    """Check every field may be null.

    Structured Outputs requires every property in `required`; nullability is what
    lets the model decline to read a field instead of inventing one.
    """
    assert set(SCHEMA["required"]) == set(FIELD_ORDER)
    for field in FIELD_ORDER:
        assert SCHEMA["properties"][field]["type"] == ["string", "null"]
    assert SCHEMA["additionalProperties"] is False


def test_queue_never_carries_the_answer_key() -> None:
    assert "_label_truth" not in json.dumps(pending_applications())
