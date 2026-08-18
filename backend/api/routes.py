"""Route declarations.

Paths and methods only: every handler delegates straight to a controller. Upload
parameters are declared here because FastAPI reads them from the signature, but
the handling still belongs to the controller.
"""

from typing import Annotated

from fastapi import APIRouter, File, Form, UploadFile, status
from fastapi.responses import FileResponse
from models.api import (
    ApplicationSummary,
    BatchRequest,
    BatchResponse,
    VerificationResponse,
)

from api import controllers

router = APIRouter(prefix="/api")


@router.get("/applications")
def get_applications() -> list[ApplicationSummary]:
    """List the applications awaiting review."""
    return controllers.list_applications()


@router.get("/labels/{application_id}", response_class=FileResponse)
def get_label(application_id: str) -> FileResponse:
    """Serve one application's submitted artwork."""
    return controllers.label_image(application_id)


@router.post("/verify/batch")
async def post_verify_batch(request: BatchRequest) -> BatchResponse:
    """Verify several applications in one run."""
    return await controllers.verify_many(request)


@router.post("/verify/upload")
async def post_verify_upload(
    image: Annotated[UploadFile, File()],
    claimed: Annotated[str, Form()],
) -> VerificationResponse:
    """Verify an arbitrary label image against values supplied with it."""
    return await controllers.verify_upload(image, claimed)


# Declared after /verify/batch and /verify/upload so those literal paths are not
# captured by this route's parameter.
@router.post("/verify/{application_id}", status_code=status.HTTP_200_OK)
async def post_verify(application_id: str) -> VerificationResponse:
    """Verify one pending application."""
    return await controllers.verify_one(application_id)
