"""HTTP layer tests.

Endpoints are exercised through TestClient with the service's extraction call
faked, so these assert routing, status codes, and response shape without touching
the network.
"""

import io
import json
import sys
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from main import app
from models.domain import ExtractedFields
from repositories.applications import version_dir
from services import verification
from services.extraction import ExtractionError

CASSETTES = Path(__file__).parent / "cassettes"

def _records() -> list[dict[str, Any]]:
    """Every seeded application, so counts follow the fixtures rather than a literal."""
    records: list[dict[str, Any]] = json.loads(
        (version_dir() / "applications.json").read_text()
    )
    return records

CLAIMED = {
    "brand_name": "OLD TOM DISTILLERY",
    "class_type": "Kentucky Straight Bourbon Whiskey",
    "alcohol_content": "45% Alc./Vol. (90 Proof)",
    "net_contents": "750 mL",
    "government_warning": True,
}


def _reading(application_id: str) -> ExtractedFields:
    payload: dict[str, Any] = json.loads(
        (CASSETTES / f"{application_id}.json").read_text()
    )
    return ExtractedFields.model_validate(payload["response"])


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture(autouse=True)
def _offline(monkeypatch: pytest.MonkeyPatch) -> None:
    """No test in this module may reach the network."""

    async def fake(image: bytes, **kwargs: object) -> ExtractedFields:
        return _reading("TTB-2024-0041")

    monkeypatch.setattr(verification, "extract", fake)


# --- Queue -----------------------------------------------------------------

def test_health(client: TestClient) -> None:
    assert client.get("/api/health").json() == {"status": "ok"}


def test_queue_lists_every_application(client: TestClient) -> None:
    response = client.get("/api/applications")
    assert response.status_code == 200
    assert len(response.json()) == len(_records())


def test_queue_never_exposes_the_answer_key(client: TestClient) -> None:
    """Serving what is printed on the label would let the tool grade itself."""
    body = client.get("/api/applications").text
    assert "_label_truth" not in body
    assert "expected_status" not in body
    assert "TITLE_CASE" not in body


def test_queue_row_carries_what_the_agent_needs(client: TestClient) -> None:
    row = client.get("/api/applications").json()[0]
    assert set(row) == {
        "application_id",
        "applicant",
        "submitted_date",
        "beverage_type",
        "artwork",
        "submitted",
    }


# --- Artwork ---------------------------------------------------------------

def test_label_image_is_served(client: TestClient) -> None:
    response = client.get("/api/labels/TTB-2024-0041")
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert response.content.startswith(b"\x89PNG")


def test_unknown_label_is_404(client: TestClient) -> None:
    assert client.get("/api/labels/TTB-9999-0000").status_code == 404


# --- Single verification ---------------------------------------------------

def test_verify_returns_all_five_rows(client: TestClient) -> None:
    body = client.post("/api/verify/TTB-2024-0041").json()
    assert len(body["fields"]) == 5
    assert body["application_id"] == "TTB-2024-0041"
    assert body["flagged"] is False


def test_verify_shows_both_values_for_every_row(client: TestClient) -> None:
    """The agent judges, so the tool must always show what it compared."""
    for row in client.post("/api/verify/TTB-2024-0041").json()["fields"]:
        assert row["claimed"]
        assert "extracted" in row
        assert row["status"] in {"match", "mismatch", "unreadable"}


def test_verify_unknown_application_is_404(client: TestClient) -> None:
    assert client.post("/api/verify/TTB-9999-0000").status_code == 404


def test_verify_reports_provider_failure_as_bad_gateway(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A label that could not be read is never reported as a verdict."""

    async def failing(image: bytes, **kwargs: object) -> ExtractedFields:
        msg = "provider is down"
        raise ExtractionError(msg)

    monkeypatch.setattr(verification, "extract", failing)
    assert client.post("/api/verify/TTB-2024-0041").status_code == 502


def test_batch_route_is_not_captured_by_the_id_parameter(client: TestClient) -> None:
    """/verify/batch must not be read as an application called 'batch'."""
    response = client.post(
        "/api/verify/batch", json={"application_ids": ["TTB-2024-0041"]}
    )
    assert response.status_code == 200
    assert response.json()["total"] == 1


# --- Batch -----------------------------------------------------------------

def test_batch_verifies_every_selected_application(client: TestClient) -> None:
    ids = ["TTB-2024-0041", "TTB-2024-0042", "TTB-2024-0043"]
    body = client.post("/api/verify/batch", json={"application_ids": ids}).json()
    assert body["total"] == 3
    assert {item["application_id"] for item in body["items"]} == set(ids)


def test_batch_rejects_an_empty_selection(client: TestClient) -> None:
    response = client.post("/api/verify/batch", json={"application_ids": []})
    assert response.status_code == 422


def test_batch_counts_errors_separately(client: TestClient) -> None:
    body = client.post(
        "/api/verify/batch",
        json={"application_ids": ["TTB-2024-0041", "TTB-9999-0000"]},
    ).json()
    assert body["error_count"] == 1
    assert body["total"] == 2


# --- Upload ----------------------------------------------------------------

LABELS = Path(__file__).resolve().parents[1] / "backend/fixtures/2026-08-18/labels"


def _png() -> bytes:
    return (LABELS / "ttb-2024-0041.png").read_bytes()


def test_upload_verifies_an_arbitrary_label(client: TestClient) -> None:
    response = client.post(
        "/api/verify/upload",
        files={"image": ("label.png", io.BytesIO(_png()), "image/png")},
        data={"claimed": json.dumps(CLAIMED)},
    )
    assert response.status_code == 200
    assert len(response.json()["fields"]) == 5


def test_upload_rejects_a_non_image(client: TestClient) -> None:
    response = client.post(
        "/api/verify/upload",
        files={"image": ("notes.txt", io.BytesIO(b"not an image"), "text/plain")},
        data={"claimed": json.dumps(CLAIMED)},
    )
    assert response.status_code == 415


def test_upload_rejects_malformed_claims(client: TestClient) -> None:
    response = client.post(
        "/api/verify/upload",
        files={"image": ("label.png", io.BytesIO(_png()), "image/png")},
        data={"claimed": "{not json"},
    )
    assert response.status_code == 422


def test_upload_rejects_incomplete_claims(client: TestClient) -> None:
    response = client.post(
        "/api/verify/upload",
        files={"image": ("label.png", io.BytesIO(_png()), "image/png")},
        data={"claimed": json.dumps({"brand_name": "OLD TOM"})},
    )
    assert response.status_code == 422
