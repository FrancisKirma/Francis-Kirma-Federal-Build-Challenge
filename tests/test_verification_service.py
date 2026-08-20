"""Service-layer tests.

The service is exercised without FastAPI and without the network: extraction is
replaced by a fake so retry behaviour, batch ordering, and failure reporting can
be driven deterministically. Cassettes supply realistic readings.
"""

import json
import sys
from pathlib import Path
from typing import Any

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from models.domain import ExtractedFields
from repositories.applications import version_dir
from services import verification
from services.extraction import ExtractionError, ProviderQuotaError

CASSETTES = Path(__file__).parent / "cassettes"

def _records() -> list[dict[str, Any]]:
    """Every seeded application, so counts follow the fixtures rather than a literal."""
    records: list[dict[str, Any]] = json.loads(
        (version_dir() / "applications.json").read_text()
    )
    return records



def _reading(application_id: str) -> ExtractedFields:
    text = (CASSETTES / f"{application_id}.json").read_text()
    payload: dict[str, Any] = json.loads(text)
    return ExtractedFields.model_validate(payload["response"])


class FakeExtractor:
    """Stands in for the vision provider. Records calls, fails on demand."""

    def __init__(
        self,
        *,
        fail_times: int = 0,
        reading: ExtractedFields | None = None,
        error: type[ExtractionError] = ExtractionError,
    ) -> None:
        self.fail_times = fail_times
        self.reading = reading or _reading("TTB-2024-0041")
        self.error = error
        self.calls = 0

    async def __call__(self, image: bytes, **kwargs: object) -> ExtractedFields:
        self.calls += 1
        if self.calls <= self.fail_times:
            msg = "simulated transient failure"
            raise self.error(msg)
        return self.reading


@pytest.fixture
def fake_extract(monkeypatch: pytest.MonkeyPatch) -> FakeExtractor:
    extractor = FakeExtractor()
    monkeypatch.setattr(verification, "extract", extractor)
    return extractor


# --- Queue -----------------------------------------------------------------

def test_pending_queue_returns_every_application() -> None:
    assert len(verification.pending_queue()) == len(_records())


def test_pending_queue_never_carries_the_answer_key() -> None:
    assert "_label_truth" not in json.dumps(verification.pending_queue())


# --- Retry policy ----------------------------------------------------------

async def test_transient_failure_is_retried_once(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    extractor = FakeExtractor(fail_times=1)
    monkeypatch.setattr(verification, "extract", extractor)

    result = await verification.read_label(b"image-bytes")

    assert extractor.calls == 2
    assert result == extractor.reading


async def test_retry_is_not_infinite(monkeypatch: pytest.MonkeyPatch) -> None:
    """A provider that is genuinely down must surface, not be retried forever."""
    extractor = FakeExtractor(fail_times=99)
    monkeypatch.setattr(verification, "extract", extractor)

    with pytest.raises(ExtractionError):
        await verification.read_label(b"image-bytes")
    assert extractor.calls == 2


async def test_quota_failure_is_not_retried(monkeypatch: pytest.MonkeyPatch) -> None:
    """An exhausted balance refuses the retry too -- it only doubles the wait."""
    extractor = FakeExtractor(fail_times=1, error=ProviderQuotaError)
    monkeypatch.setattr(verification, "extract", extractor)

    with pytest.raises(ProviderQuotaError):
        await verification.read_label(b"image-bytes")
    assert extractor.calls == 1


async def test_success_is_not_retried(fake_extract: FakeExtractor) -> None:
    await verification.read_label(b"image-bytes")
    assert fake_extract.calls == 1


async def test_slow_failure_is_not_retried(monkeypatch: pytest.MonkeyPatch) -> None:
    """A retry must not push a single label past the five-second budget.

    When the first attempt already consumed the time a retry would need, the
    failure surfaces immediately instead.
    """
    extractor = FakeExtractor(fail_times=1)
    monkeypatch.setattr(verification, "extract", extractor)
    monkeypatch.setattr(verification, "RETRY_IF_ELAPSED_UNDER", -1.0)

    with pytest.raises(ExtractionError):
        await verification.read_label(b"image-bytes")
    assert extractor.calls == 1


# --- Single verification ---------------------------------------------------

async def test_verify_application_compares_against_the_claim(
    fake_extract: FakeExtractor,
) -> None:
    result, elapsed = await verification.verify_application("TTB-2024-0041")

    assert result.application_id == "TTB-2024-0041"
    assert result.flagged is False
    assert elapsed >= 0


async def test_unknown_application_is_rejected(fake_extract: FakeExtractor) -> None:
    with pytest.raises(verification.ApplicationNotFoundError):
        await verification.verify_application("TTB-9999-0000")


async def test_verify_image_uses_supplied_claims(fake_extract: FakeExtractor) -> None:
    claimed = {
        "brand_name": "OLD TOM DISTILLERY",
        "class_type": "Kentucky Straight Bourbon Whiskey",
        "alcohol_content": "45% Alc./Vol. (90 Proof)",
        "net_contents": "750 mL",
        "government_warning": True,
    }
    result, _ = await verification.verify_image(b"image-bytes", claimed)
    assert result.flagged is False


# --- Batch -----------------------------------------------------------------

async def test_batch_returns_one_entry_per_request(fake_extract: FakeExtractor) -> None:
    ids = ["TTB-2024-0041", "TTB-2024-0042", "TTB-2024-0043"]
    outcomes = await verification.verify_batch(ids)
    assert {entry[0] for entry in outcomes} == set(ids)


async def test_batch_reports_failures_rather_than_dropping_them(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A dropped row means the agent silently reviews fewer applications."""
    extractor = FakeExtractor(fail_times=99)
    monkeypatch.setattr(verification, "extract", extractor)

    outcomes = await verification.verify_batch(["TTB-2024-0041", "TTB-2024-0042"])

    assert len(outcomes) == 2
    assert all(entry[3] is not None for entry in outcomes)
    assert all(entry[1] is None for entry in outcomes)


async def test_batch_reports_unknown_ids(fake_extract: FakeExtractor) -> None:
    outcomes = await verification.verify_batch(["TTB-2024-0041", "TTB-9999-0000"])
    errors = {entry[0]: entry[3] for entry in outcomes}
    assert errors["TTB-9999-0000"] == "not found"
    assert errors["TTB-2024-0041"] is None


async def test_batch_puts_problems_before_clean_rows(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Flagged and failed rows first: a clean row needs a glance, not a review."""

    async def selective(image: bytes, **kwargs: object) -> ExtractedFields:
        # 0044's reading carries a title-case warning, so it must flag.
        return _reading("TTB-2024-0044")

    monkeypatch.setattr(verification, "extract", selective)
    outcomes = await verification.verify_batch(
        ["TTB-2024-0041", "TTB-2024-0044", "TTB-9999-0000"]
    )

    ranks = [
        0 if error is not None else (1 if result is not None and result.flagged else 2)
        for _, result, _, error in outcomes
    ]
    assert ranks == sorted(ranks)
    assert outcomes[0][0] == "TTB-9999-0000"


async def test_batch_concurrency_is_bounded(monkeypatch: pytest.MonkeyPatch) -> None:
    """Unbounded fan-out would open a provider connection per selected label."""
    active = 0
    peak = 0

    async def counting(image: bytes, **kwargs: object) -> ExtractedFields:
        nonlocal active, peak
        active += 1
        peak = max(peak, active)
        try:
            return _reading("TTB-2024-0041")
        finally:
            active -= 1

    monkeypatch.setattr(verification, "extract", counting)
    ids = [record["application_id"] for record in verification.pending_queue()]
    await verification.verify_batch(ids)

    assert peak <= verification.MAX_CONCURRENCY
