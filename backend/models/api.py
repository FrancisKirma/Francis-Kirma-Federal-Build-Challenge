"""Request and response bodies for the HTTP layer."""

from pydantic import BaseModel, Field

from models.domain import FieldResult, VerificationResult


class ApplicationSummary(BaseModel):
    """One row of the pending queue, as served to the client."""

    application_id: str
    applicant: str
    submitted_date: str
    beverage_type: str
    artwork: str
    submitted: dict[str, str | bool]


class VerificationResponse(BaseModel):
    """Result of comparing one application against its artwork."""

    application_id: str | None = None
    fields: list[FieldResult]
    flagged: bool
    elapsed_seconds: float

    @classmethod
    def build(
        cls, result: VerificationResult, elapsed: float
    ) -> "VerificationResponse":
        """Wrap a domain result with the timing the agent sees."""
        return cls(
            application_id=result.application_id,
            fields=result.fields,
            flagged=result.flagged,
            elapsed_seconds=round(elapsed, 3),
        )


class BatchItem(BaseModel):
    """One application's outcome within a batch run.

    Either ``result`` or ``error`` is set: a batch must report a label that could
    not be read rather than dropping it, or the agent silently reviews fewer
    applications than they selected.
    """

    application_id: str
    result: VerificationResponse | None = None
    error: str | None = None


class BatchResponse(BaseModel):
    """A batch run, flagged applications first."""

    items: list[BatchItem]
    total: int
    flagged_count: int
    error_count: int
    elapsed_seconds: float


class BatchRequest(BaseModel):
    """Applications selected from the queue for a batch run."""

    application_ids: list[str] = Field(min_length=1, max_length=25)
