"""Compare an applicant's claimed values against what was read off the artwork.

Pure functions, no model dependency, so this is testable against hand-written
extraction dictionaries and is built before the extraction layer is wired up.

One matching rule for all five fields fails in both directions -- it either
rejects ``STONE'S THROW`` against ``Stone's Throw`` or accepts a title-case
government warning. Fields are therefore compared by type:

* normalized -- brand name, class/type
* numeric    -- alcohol content, net contents
* exact      -- government warning
"""

import re
import unicodedata
from typing import Final

from constants import STATUTORY_WARNING
from models import (
    FIELD_ORDER,
    ClaimedFields,
    ExtractedFields,
    FieldResult,
    Status,
    VerificationResult,
)

# Volumes are compared in millilitres so 0.75 L and 750 mL agree.
#
# Fluid ounces are deliberately absent. 25.4 oz is 751.1 mL, the same bottle at a
# different number, so converting would turn a labelling equivalence into a
# numeric near-miss that reads as a bug. Ounces compare only against ounces;
# cross-unit matching would need a tolerance band, which US-market labels have
# not required here.
_TO_ML: Final[dict[str, float]] = {"ml": 1.0, "cl": 10.0, "l": 1000.0}

# ABV first: the percentage governs, and proof is a second number on the same
# line that must not be picked up instead. See test_proof_is_ignored_not_parsed.
_ABV: Final = re.compile(r"(\d+(?:\.\d+)?)\s*%")
_VOLUME: Final = re.compile(
    r"(\d+(?:\.\d+)?)\s*(ml|cl|l|oz|fl\.?\s*oz)\b", re.IGNORECASE
)

# Curly quotes normalise to straight ones; a typographic apostrophe is not a
# difference in the brand name.
_QUOTES: Final = str.maketrans(
    {"\u2018": "'", "\u2019": "'", "\u201c": '"', "\u201d": '"'}
)

NORMALIZED_FIELDS: Final = ("brand_name", "class_type")
NUMERIC_FIELDS: Final = ("alcohol_content", "net_contents")
EXACT_FIELDS: Final = ("government_warning",)


def normalize(value: str) -> str:
    """Casefold, strip punctuation, collapse whitespace.

    Absorbs benign presentation differences -- capitalisation, curly quotes,
    trailing periods -- without absorbing an actual difference in wording.
    """
    folded = unicodedata.normalize("NFKD", value.translate(_QUOTES)).casefold()
    folded = re.sub(r"[^\w\s]", "", folded)
    return re.sub(r"\s+", " ", folded).strip()


def parse_measure(value: str) -> tuple[float, str] | None:
    """Read a printed measurement as ``(amount, canonical_unit)``.

    Percentages return ``"%"``; volumes convert to millilitres. Returns ``None``
    when nothing numeric can be read, which surfaces as ``unreadable``.
    """
    percent = _ABV.search(value)
    if percent is not None:
        return float(percent.group(1)), "%"

    volume = _VOLUME.search(value)
    if volume is None:
        return None

    amount = float(volume.group(1))
    unit = re.sub(r"[.\s]", "", volume.group(2)).lower()
    if unit in _TO_ML:
        return round(amount * _TO_ML[unit], 3), "ml"
    return amount, "oz"


def _is_blank(value: str | None) -> bool:
    """Report whether a reading is empty, i.e. the model returned nothing."""
    return value is None or not value.strip()


def _exact_status(extracted: str) -> Status:
    """Compare the printed warning against the statutory text.

    Whitespace is normalised because a vision model returns breaks where the
    label wraps, which is a rendering artifact. Casing is never normalised: it is
    exactly the tampering this field exists to catch.
    """
    collapsed = re.sub(r"\s+", " ", extracted).strip()
    return Status.MATCH if collapsed == STATUTORY_WARNING else Status.MISMATCH


def _numeric_status(claimed: str, extracted: str) -> Status:
    """Compare two printed measurements as values."""
    extracted_measure = parse_measure(extracted)
    if extracted_measure is None:
        return Status.UNREADABLE
    claimed_measure = parse_measure(claimed)
    if claimed_measure is None:
        return Status.MISMATCH
    if claimed_measure == extracted_measure:
        return Status.MATCH
    return Status.MISMATCH


def _normalized_status(claimed: str, extracted: str) -> Status:
    """Compare two strings once benign presentation differences are folded away."""
    if normalize(claimed) == normalize(extracted):
        return Status.MATCH
    return Status.MISMATCH


def compare_field(
    field: str,
    claimed: str | bool,  # noqa: FBT001  (the warning attestation is genuinely a bool)
    extracted: str | None,
) -> FieldResult:
    """Compare one field and resolve its status.

    ``claimed`` is a bool only for the government warning, where the applicant
    attests presence and the extracted text is compared against the statute
    rather than against the attestation.
    """
    claimed_display = str(claimed)

    if _is_blank(extracted):
        return FieldResult(
            field=field,
            claimed=claimed_display,
            extracted=None,
            status=Status.UNREADABLE,
        )
    assert extracted is not None  # noqa: S101  (narrowing for the type checker)

    if field in EXACT_FIELDS:
        status = _exact_status(extracted)
    elif field in NUMERIC_FIELDS:
        status = _numeric_status(claimed_display, extracted)
    elif field in NORMALIZED_FIELDS:
        status = _normalized_status(claimed_display, extracted)
    else:
        msg = f"no comparison strategy for field: {field!r}"
        raise ValueError(msg)

    return FieldResult(
        field=field, claimed=claimed_display, extracted=extracted, status=status
    )


def compare_record(
    claimed: ClaimedFields | dict[str, object],
    extracted: ExtractedFields | dict[str, object],
    application_id: str | None = None,
) -> VerificationResult:
    """Compare all five fields for one application."""
    claims = ClaimedFields.model_validate(claimed)
    readings = ExtractedFields.model_validate(extracted)

    return VerificationResult(
        application_id=application_id,
        fields=[
            compare_field(field, getattr(claims, field), getattr(readings, field))
            for field in FIELD_ORDER
        ],
    )
