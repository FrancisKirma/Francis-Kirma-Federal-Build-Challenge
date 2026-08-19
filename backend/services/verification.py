"""Orchestration: load an application, read its artwork, compare the two.

This is the layer that sequences extraction and comparison and owns the retry
policy. It knows nothing about HTTP -- it raises domain errors and returns domain
results, so it is testable without FastAPI.
"""

import asyncio
from time import perf_counter
from typing import Any, Final

from models.domain import ExtractedFields, VerificationResult
from repositories.applications import label_path, pending_applications

from services.comparison import compare_record
from services.extraction import TIMEOUT_SECONDS, ExtractionError, extract

# One retry, and only when there is time to spend on it. A transient network
# stall is common enough to be worth absorbing -- one was observed while
# recording cassettes -- but a second attempt on an already-slow call would push
# the agent well past a reasonable wait, so it only happens when the first
# attempt failed quickly.
RETRY_IF_ELAPSED_UNDER: Final = 2.5

# Bounded so a large selection cannot open an unbounded number of provider
# connections. Batch total time is not the per-label budget; that is stated in
# the UI rather than engineered away.
MAX_CONCURRENCY: Final = 5


class ApplicationNotFoundError(LookupError):
    """No pending application carries the requested id."""


def pending_queue() -> list[dict[str, Any]]:
    """Return the applications awaiting review, without their answer key."""
    return pending_applications()


def _find(application_id: str) -> dict[str, Any]:
    for record in pending_applications():
        if record["application_id"] == application_id:
            return record
    msg = f"no pending application with id {application_id!r}"
    raise ApplicationNotFoundError(msg)


async def read_label(image: bytes) -> ExtractedFields:
    """Extract label fields, retrying once on a transient provider failure.

    Only ``ExtractionError`` is retried: a reading that succeeded but disagrees
    with the claim is a result, not a failure, and retrying it would be a way of
    shopping for the answer the applicant wanted.
    """
    started = perf_counter()
    try:
        return await extract(image)
    except ExtractionError:
        if perf_counter() - started >= RETRY_IF_ELAPSED_UNDER:
            raise
        return await extract(image)


async def verify_application(application_id: str) -> tuple[VerificationResult, float]:
    """Verify one pending application against its submitted artwork."""
    record = _find(application_id)
    started = perf_counter()
    extracted = await read_label(label_path(application_id).read_bytes())
    result = compare_record(record["submitted"], extracted, application_id)
    return result, perf_counter() - started


async def verify_image(
    image: bytes, claimed: dict[str, Any]
) -> tuple[VerificationResult, float]:
    """Verify an ad-hoc image against values supplied with it."""
    started = perf_counter()
    extracted = await read_label(image)
    result = compare_record(claimed, extracted)
    return result, perf_counter() - started


async def verify_batch(
    application_ids: list[str],
) -> list[tuple[str, VerificationResult | None, float, str | None]]:
    """Verify several applications concurrently.

    Returns one entry per requested id in flagged-first order. A failure is
    reported rather than dropped, so the agent sees every application they
    selected.
    """
    limit = asyncio.Semaphore(MAX_CONCURRENCY)

    async def run(
        application_id: str,
    ) -> tuple[str, VerificationResult | None, float, str | None]:
        async with limit:
            started = perf_counter()
            try:
                result, elapsed = await verify_application(application_id)
            except ApplicationNotFoundError:
                return application_id, None, perf_counter() - started, "not found"
            except ExtractionError as exc:
                return application_id, None, perf_counter() - started, str(exc)
            return application_id, result, elapsed, None

    outcomes = await asyncio.gather(*(run(app_id) for app_id in application_ids))

    # Errors first, then flagged, then clean: both demand the agent's attention,
    # and a row that could not be read is the one most easily missed.
    def rank(entry: tuple[str, VerificationResult | None, float, str | None]) -> int:
        _, result, _, error = entry
        if error is not None:
            return 0
        return 1 if result is not None and result.flagged else 2

    return sorted(outcomes, key=rank)


TIMEOUT_BUDGET: Final = TIMEOUT_SECONDS
