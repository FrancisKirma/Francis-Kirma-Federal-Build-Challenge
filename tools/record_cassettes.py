"""Record real vision-model responses for the fixture labels.

Run by hand with a key present; the cassettes are committed so the test suite
runs offline, deterministically, and without spending money on every CI run.

    uv run python tools/record_cassettes.py

Cassettes are a regression baseline, not proof the live model still behaves --
re-record when the model or the prompt changes.
"""

import asyncio
import json
import os
import pathlib
import sys
import time
from typing import Any

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "backend"))

from constants import STATUTORY_WARNING, WARNING_VARIANTS
from repositories.applications import label_path, pending_applications
from services.extraction import DEFAULT_MODELS, ExtractionError, extract

CASSETTES = pathlib.Path(__file__).resolve().parents[1] / "tests" / "cassettes"

# The product requirement: a single-label result in under five seconds.
BUDGET_SECONDS = 5.0


def _load_dotenv() -> None:
    """Read .env into the environment; the recorder is a local, hand-run script."""
    env_file = pathlib.Path(__file__).resolve().parents[1] / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text().splitlines():
        stripped = line.strip()
        if stripped and not stripped.startswith("#") and "=" in stripped:
            key, value = stripped.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())


def _warning_verdict(printed: str, extracted: str | None) -> str:
    """Describe how a transcribed warning compares to what the label carries."""
    expected = WARNING_VARIANTS[printed]
    if expected is None:
        return "null (correct)" if extracted is None else "HALLUCINATED"
    if extracted is None:
        return "null (MISSED)"
    if extracted == expected:
        return "verbatim" if expected == STATUTORY_WARNING else "verbatim (title case)"
    return "ALTERED"


async def _record() -> int:
    """Record one cassette per fixture and report latency and fidelity."""
    _load_dotenv()
    provider = os.environ.get("AI_PROVIDER", "openai")
    model = os.environ.get("AI_MODEL") or DEFAULT_MODELS[provider]
    CASSETTES.mkdir(parents=True, exist_ok=True)

    records = pending_applications()
    version = label_path(records[0]["application_id"]).parents[1]
    applications = version / "applications.json"
    truths = {
        r["application_id"]: r["_label_truth"]["printed"]["government_warning"]
        for r in json.loads(applications.read_text())
    }

    timings: list[float] = []
    failures: list[str] = []
    print(f"provider={provider} model={model}\n")
    for record in records:
        app_id = record["application_id"]
        image = label_path(app_id).read_bytes()

        started = time.perf_counter()
        try:
            fields = await extract(image)
        except ExtractionError as exc:
            elapsed = time.perf_counter() - started
            failures.append(app_id)
            print(f"  {app_id}  {elapsed:5.2f}s  FAILED: {exc}")
            continue
        elapsed = time.perf_counter() - started
        timings.append(elapsed)

        payload: dict[str, Any] = {
            "application_id": app_id,
            "provider": provider,
            "model": model,
            "elapsed_seconds": round(elapsed, 3),
            "response": fields.model_dump(),
        }
        (CASSETTES / f"{app_id}.json").write_text(json.dumps(payload, indent=2) + "\n")

        verdict = _warning_verdict(truths[app_id], fields.government_warning)
        suspect = any(mark in verdict for mark in ("MISSED", "ALTERED", "HALLUCINATED"))
        flag = "  <-- CHECK" if suspect else ""
        print(f"  {app_id}  {elapsed:5.2f}s  warning: {verdict}{flag}")

    if not timings:
        print("\nno cassettes recorded")
        return 1

    timings.sort()
    print(
        f"\n{len(timings)} recorded | "
        f"min {timings[0]:.2f}s  median {timings[len(timings) // 2]:.2f}s  "
        f"max {timings[-1]:.2f}s"
    )
    over = [t for t in timings if t >= BUDGET_SECONDS]
    if over:
        print(f"WARNING: {len(over)} call(s) at or over the {BUDGET_SECONDS}s budget")
    if failures:
        print(f"FAILED to record: {', '.join(failures)}")
        return 1
    return 0


def main() -> int:
    """Entry point; the recorder drives the async extraction path."""
    return asyncio.run(_record())


if __name__ == "__main__":
    raise SystemExit(main())
