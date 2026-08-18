"""Shared shapes for verification.

Pydantic v2 throughout, so a malformed vision-model response fails at the parse
boundary with a useful error rather than surfacing as a wrong status later.
"""

from enum import StrEnum
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

FIELD_ORDER: tuple[str, ...] = (
    "brand_name",
    "class_type",
    "alcohol_content",
    "net_contents",
    "government_warning",
)


class Status(StrEnum):
    """Per-field outcome.

    ``UNREADABLE`` means the model declined to read the field; it never results
    from a comparison failing. The two call for different agent actions.
    """

    MATCH = "match"
    MISMATCH = "mismatch"
    UNREADABLE = "unreadable"


class ClaimedFields(BaseModel):
    """What the applicant submitted on the form."""

    model_config = ConfigDict(extra="forbid")

    brand_name: str
    class_type: str
    alcohol_content: str
    net_contents: str
    # The form asks whether the statement is present; the label carries the text.
    government_warning: bool


class ExtractedFields(BaseModel):
    """What the vision model read off the artwork.

    Every field is optional: a field the model cannot read must come back ``None``
    rather than guessed, because a hallucinated value that happens to match the
    claim is the worst failure this tool has.
    """

    model_config = ConfigDict(extra="forbid")

    brand_name: str | None = None
    class_type: str | None = None
    alcohol_content: str | None = None
    net_contents: str | None = None
    government_warning: str | None = None


class FieldResult(BaseModel):
    """One row of the review table."""

    field: str
    claimed: str
    extracted: str | None
    status: Status


class VerificationResult(BaseModel):
    """All five rows for one application."""

    application_id: str | None = None
    fields: list[FieldResult] = Field(min_length=5, max_length=5)

    @model_validator(mode="after")
    def _check_field_coverage(self) -> Self:
        seen = [f.field for f in self.fields]
        if seen != list(FIELD_ORDER):
            msg = f"expected fields in order {FIELD_ORDER}, got {tuple(seen)}"
            raise ValueError(msg)
        return self

    @property
    def flagged(self) -> bool:
        """True when any row needs the agent's attention."""
        return any(f.status is not Status.MATCH for f in self.fields)
