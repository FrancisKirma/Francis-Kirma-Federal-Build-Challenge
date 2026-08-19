"""Application assembly.

Wiring only: create the app, mount the API router, and serve the built frontend.
Routing lives in api.routes, request handling in api.controllers, and the work
itself in services.
"""

from pathlib import Path

from api.routes import router
from fastapi import FastAPI

# The Vite build output. Absent in a bare backend checkout and during backend
# tests, so serving it is conditional rather than assumed.
FRONTEND_DIST = Path(__file__).resolve().parents[1] / "frontend" / "dist"

app = FastAPI(
    title="TTB Label Verification",
    description="Compare an applicant's claimed label values against their artwork.",
    version="0.1.0",
)
app.include_router(router)


@app.get("/api/health")
def health() -> dict[str, str]:
    """Liveness check for the deployment."""
    return {"status": "ok"}


if FRONTEND_DIST.is_dir():
    # Mounted last so it cannot shadow /api. On Vercel these files are promoted
    # to the CDN at build time, so the function is not in the path for them.
    app.frontend("/", directory=str(FRONTEND_DIST))
