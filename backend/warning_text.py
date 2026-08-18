"""Canonical statutory health warning text, per 27 CFR 16.21.

This is the reference string the ``government_warning`` field is compared against
with exact, case-sensitive equality. Do not reflow, retype, or "fix" it: a single
changed character here silently breaks every comparison in the tool.

Source: 27 CFR 16.21 (Mandatory label information).
https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-16/subpart-C/section-16.21
"""

from typing import Final

STATUTORY_WARNING: Final = (
    "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not "
    "drink alcoholic beverages during pregnancy because of the risk of birth "
    "defects. (2) Consumption of alcoholic beverages impairs your ability to "
    "drive a car or operate machinery, and may cause health problems."
)

# Variants used only to render the deliberately-broken fixture labels. These are
# test data, never comparison targets.
WARNING_VARIANTS: Final[dict[str, str | None]] = {
    "STATUTORY": STATUTORY_WARNING,
    # 0044: correct wording, wrong casing. Must fail the exact match.
    "TITLE_CASE": (
        "Government Warning: (1) According To The Surgeon General, Women Should "
        "Not Drink Alcoholic Beverages During Pregnancy Because Of The Risk Of "
        "Birth Defects. (2) Consumption Of Alcoholic Beverages Impairs Your "
        "Ability To Drive A Car Or Operate Machinery, And May Cause Health "
        "Problems."
    ),
    # 0048: no warning printed on the artwork at all.
    "ABSENT": None,
}


def _self_check() -> None:
    """Guard the properties the comparison layer depends on."""
    assert STATUTORY_WARNING.startswith("GOVERNMENT WARNING: (1) According to")
    assert STATUTORY_WARNING.endswith("may cause health problems.")
    assert "  " not in STATUTORY_WARNING, "no double spaces; exact match is byte-for-byte"
    assert "\n" not in STATUTORY_WARNING, "single line; renderer handles wrapping"

    title_case = WARNING_VARIANTS["TITLE_CASE"]
    assert title_case is not None
    # The whole point of 0044: same words, different case, must not compare equal.
    assert title_case != STATUTORY_WARNING
    assert title_case.lower() == STATUTORY_WARNING.lower()

    assert WARNING_VARIANTS["ABSENT"] is None
    print("warning_text: OK")


if __name__ == "__main__":
    _self_check()
