"""Request handling.

Controllers own HTTP concerns only: reading the request, translating service
errors into status codes, and shaping the response. All work belongs to the
service layer.
"""

import json
from time import perf_counter
from typing import Annotated, Any, Final

from fastapi import File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from models.api import (
    ApplicationSummary,
    BatchItem,
    BatchRequest,
    BatchResponse,
    VerificationResponse,
)
from models.domain import ClaimedFields
from pydantic import ValidationError
from repositories.applications import label_path
from services import verification
from services.extraction import MAX_UPLOAD_BYTES, ExtractionError, InvalidImageError

ALLOWED_UPLOAD_TYPES: Final = frozenset({"image/jpeg", "image/png", "image/webp"})


def list_applications() -> list[ApplicationSummary]:
    """Return the pending review queue."""
    return [
        ApplicationSummary.model_validate(record)
        for record in verification.pending_queue()
    ]


async def verify_one(application_id: str) -> VerificationResponse:
    """Verify a single pending application against its artwork."""
    try:
        result, elapsed = await verification.verify_application(application_id)
    except verification.ApplicationNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except InvalidImageError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from exc
    except ExtractionError as exc:
        # The label could not be read. That is a service failure, not a verdict:
        # never report it as a clean or failing review.
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc
    return VerificationResponse.build(result, elapsed)


async def verify_many(request: BatchRequest) -> BatchResponse:
    """Verify several applications, flagged and failed rows first."""
    started = perf_counter()
    outcomes = await verification.verify_batch(request.application_ids)

    items = [
        BatchItem(
            application_id=application_id,
            result=VerificationResponse.build(result, elapsed) if result else None,
            error=error,
        )
        for application_id, result, elapsed, error in outcomes
    ]
    flagged = sum(1 for i in items if i.result is not None and i.result.flagged)
    return BatchResponse(
        items=items,
        total=len(items),
        flagged_count=flagged,
        error_count=sum(1 for i in items if i.error is not None),
        elapsed_seconds=round(perf_counter() - started, 3),
    )


async def verify_upload(
    image: Annotated[UploadFile, File()],
    claimed: Annotated[str, Form()],
) -> VerificationResponse:
    """Verify an arbitrary label image against values supplied with it.

    ``claimed`` is a JSON object carrying the same five fields an application
    would, so a reviewer can test artwork that is not in the queue.
    """
    if image.content_type not in ALLOWED_UPLOAD_TYPES:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            "Upload a JPEG, PNG, or WebP image.",
        )

    payload = await image.read()
    if len(payload) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status.HTTP_413_CONTENT_TOO_LARGE,
            "That image is too large. The limit is 20 MB.",
        )

    try:
        parsed: Any = json.loads(claimed)
        fields = ClaimedFields.model_validate(parsed)
    except (json.JSONDecodeError, ValidationError) as exc:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "The claimed values must be a JSON object with all five fields.",
        ) from exc

    try:
        result, elapsed = await verification.verify_image(payload, fields.model_dump())
    except InvalidImageError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from exc
    except ExtractionError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc
    return VerificationResponse.build(result, elapsed)


def label_image(application_id: str) -> FileResponse:
    """Serve one application's artwork so the agent can see what was read."""
    try:
        path = label_path(application_id)
    except KeyError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such application.") from exc
    if not path.exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Artwork is not available.")
    return FileResponse(path, media_type="image/png")
