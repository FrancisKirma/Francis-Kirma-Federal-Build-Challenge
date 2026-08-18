"""Application assembly.

Wiring only: create the app, mount the API router. Routing lives in api.routes,
request handling in api.controllers, and the work itself in services.
"""

from api.routes import router
from fastapi import FastAPI

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
