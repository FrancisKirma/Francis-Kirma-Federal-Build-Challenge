"""Comparison engine tests.

The fixture set is a known-answer table: each record declares what every field's
status should be, so feeding ``_label_truth.printed`` in as simulated perfect
extraction and asserting against ``expected_status`` exercises all three
strategies against realistic data for free.

The hand-written cases below cover what the fixtures cannot: proof-vs-ABV, unit
conversion, curly punctuation, and the null/empty distinction.
"""

import json
import sys
from pathlib import Path
from typing import Any

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from comparison import compare_field, compare_record, normalize, parse_measure
from fixtures import pending_applications, version_dir
from models import Status, VerificationResult
from warning_text import STATUTORY_WARNING, WARNING_VARIANTS


def _records() -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = json.loads(
        (version_dir() / "applications.json").read_text()
    )
    return records


# --- The known-answer table ------------------------------------------------

@pytest.mark.parametrize("record", _records(), ids=lambda r: r["application_id"])
def test_fixture_expectations(record: dict[str, Any]) -> None:
    """Perfect extraction of each label must yield its declared expected_status."""
    printed = dict(record["_label_truth"]["printed"])
    # The fixture stores a variant name; extraction would return the text itself.
    printed["government_warning"] = WARNING_VARIANTS[printed["government_warning"]]

    result = compare_record(record["submitted"], printed)
    got = {f.field: f.status for f in result.fields}
    assert got == record["_label_truth"]["expected_status"]


def test_fixture_set_exercises_every_status() -> None:
    """A table that is all green would pass while testing nothing."""
    statuses = {
        s for r in _records() for s in r["_label_truth"]["expected_status"].values()
    }
    assert statuses == {"match", "mismatch", "unreadable"}


# --- Normalized strategy ---------------------------------------------------

@pytest.mark.parametrize(
    ("claimed", "extracted"),
    [
        ("Stone's Throw", "STONE'S THROW"),          # Dave's case
        ("Stone's Throw", "Stone’s Throw"),     # curly apostrophe
        ("Old  Tom   Distillery", "OLD TOM DISTILLERY"),
        ("Kentucky Straight Bourbon Whiskey", "kentucky straight bourbon whiskey."),
        ("Maison Duval", "MAISON DUVAL "),
    ],
)
def test_normalized_matches(claimed: str, extracted: str) -> None:
    assert compare_field("brand_name", claimed, extracted).status == Status.MATCH


@pytest.mark.parametrize(
    ("claimed", "extracted"),
    [
        ("Kentucky Straight Bourbon Whiskey", "Kentucky Bourbon"),  # 0046
        ("Straight Rye Whiskey", "Straight Bourbon Whiskey"),
        ("Harbor Light", "Harbour Light"),
    ],
)
def test_normalized_mismatches(claimed: str, extracted: str) -> None:
    assert compare_field("class_type", claimed, extracted).status == Status.MISMATCH


def test_normalize_is_idempotent() -> None:
    once = normalize("  STONE’S   THROW!  ")
    assert normalize(once) == once


# --- Numeric strategy ------------------------------------------------------

@pytest.mark.parametrize(
    ("claimed", "extracted"),
    [
        ("45% Alc./Vol. (90 Proof)", "45% ABV"),
        ("45% Alc./Vol. (90 Proof)", "45.0% Alc/Vol"),
        ("40% Alc./Vol. (80 Proof)", "40% Alc./Vol. (80 Proof)"),
        ("43% Alc./Vol. (86 Proof)", "ALC. 43% BY VOL."),
    ],
)
def test_abv_matches(claimed: str, extracted: str) -> None:
    assert compare_field("alcohol_content", claimed, extracted).status == Status.MATCH


def test_proof_is_ignored_not_parsed() -> None:
    """Proof is the second number on the line; ABV governs.

    A parser that grabs the first number it sees would read 90 here and compare
    90 against 45, so this pins the anchor to the percentage.
    """
    assert parse_measure("45% Alc./Vol. (90 Proof)") == (45.0, "%")
    # Same ABV, proof omitted -- must still match.
    assert compare_field(
        "alcohol_content", "45% Alc./Vol. (90 Proof)", "45% Alc./Vol."
    ).status == Status.MATCH


@pytest.mark.parametrize(
    ("claimed", "extracted"),
    [
        ("750 mL", "750ml"),
        ("750 mL", "750 ML"),
        ("750 mL", "0.75 L"),      # European notation, same volume
        ("750 mL", "75 cL"),       # centilitres, same volume
        ("1 L", "1000 mL"),
    ],
)
def test_volume_matches_across_units(claimed: str, extracted: str) -> None:
    assert compare_field("net_contents", claimed, extracted).status == Status.MATCH


@pytest.mark.parametrize(
    ("claimed", "extracted"),
    [
        ("750 mL", "700 mL"),      # 0045
        ("750 mL", "0.7 L"),
        ("45% Alc./Vol.", "43% Alc./Vol."),  # 0043
        ("750 mL", "25.4 oz"),     # ounces are not converted; see comparison.py
    ],
)
def test_numeric_mismatches(claimed: str, extracted: str) -> None:
    field = "net_contents" if "L" in claimed or "oz" in extracted else "alcohol_content"
    assert compare_field(field, claimed, extracted).status == Status.MISMATCH


# --- Exact strategy (government warning) -----------------------------------

def test_statutory_warning_matches() -> None:
    result = compare_field("government_warning", True, STATUTORY_WARNING)
    assert result.status == Status.MATCH


def test_warning_line_wrapping_is_absorbed() -> None:
    """A vision model returns breaks where the label wraps; that is not a defect."""
    wrapped = STATUTORY_WARNING.replace(" ", "\n", 3)
    wrapped = wrapped.replace("General,", "General,  ")
    assert compare_field("government_warning", True, wrapped).status == Status.MATCH


def test_title_case_warning_fails() -> None:
    """0044. Correct wording, wrong casing -- the whole point of exact matching."""
    title = WARNING_VARIANTS["TITLE_CASE"]
    assert title is not None
    assert title.lower() == STATUTORY_WARNING.lower()  # same words
    assert compare_field("government_warning", True, title).status == Status.MISMATCH


@pytest.mark.parametrize(
    "variant",
    [
        STATUTORY_WARNING.replace("GOVERNMENT WARNING:", "Government Warning:"),
        STATUTORY_WARNING.replace("Surgeon General", "surgeon general"),
        STATUTORY_WARNING.replace("birth defects", "birth defect"),
        STATUTORY_WARNING.rstrip("."),
        STATUTORY_WARNING.replace("(1)", "1."),
    ],
)
def test_warning_variants_all_fail(variant: str) -> None:
    assert compare_field("government_warning", True, variant).status == Status.MISMATCH


def test_absent_warning_is_unreadable_not_mismatch() -> None:
    """0048. 'I could not find it' is a different agent action than 'these disagree'."""
    assert compare_field("government_warning", True, None).status == Status.UNREADABLE


# --- Unreadable handling ---------------------------------------------------

@pytest.mark.parametrize(
    "field", ["brand_name", "class_type", "alcohol_content", "net_contents"]
)
def test_none_extraction_is_unreadable(field: str) -> None:
    assert compare_field(field, "anything", None).status == Status.UNREADABLE


def test_empty_string_is_unreadable_too() -> None:
    """An empty string is the model returning nothing, not a value that mismatches."""
    assert compare_field("brand_name", "OLD TOM", "").status == Status.UNREADABLE
    assert compare_field("brand_name", "OLD TOM", "   ").status == Status.UNREADABLE


def test_unparseable_number_is_unreadable() -> None:
    result = compare_field("net_contents", "750 mL", "smudged")
    assert result.status == Status.UNREADABLE


# --- Result shape ----------------------------------------------------------

def test_result_carries_both_values_for_every_field() -> None:
    """The agent judges; the tool must always show what it compared."""
    record = _records()[0]
    printed = dict(record["_label_truth"]["printed"])
    printed["government_warning"] = WARNING_VARIANTS[printed["government_warning"]]
    result = compare_record(record["submitted"], printed)

    assert len(result.fields) == 5
    for field in result.fields:
        assert field.claimed is not None
        assert field.extracted is not None


def test_flagged_is_true_when_any_field_needs_attention() -> None:
    clean = _records()[0]
    broken = next(r for r in _records() if r["application_id"] == "TTB-2024-0044")

    def run(record: dict[str, Any]) -> VerificationResult:
        printed = dict(record["_label_truth"]["printed"])
        printed["government_warning"] = WARNING_VARIANTS[printed["government_warning"]]
        return compare_record(record["submitted"], printed)

    assert run(clean).flagged is False
    assert run(broken).flagged is True


def test_queue_never_carries_the_answer_key() -> None:
    assert "_label_truth" not in json.dumps(pending_applications())
