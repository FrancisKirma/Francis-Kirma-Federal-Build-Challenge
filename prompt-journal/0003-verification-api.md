## 2026-08-18 — Verification endpoints: retry policy and failures that aren't verdicts

**Asked:** Add the FastAPI layer — queue listing, artwork serving, single verify,
batch verify, and ad-hoc upload — on top of the extraction and comparison
modules.

**Produced:** Routes, controllers, and a `services/verification.py` orchestrator,
with `extraction` converted to async so a batch can run concurrently. The retry
wrapper retried any exception from `extract`, batch used unbounded
`asyncio.gather`, and a label that failed extraction was dropped from the batch
response.

**Accepted / Rejected:** Accepted the layering (api → services → repositories)
and the async conversion. REJECTED the blanket retry — only `ExtractionError`
retries, and only when under `RETRY_IF_ELAPSED_UNDER = 2.0`. REJECTED unbounded
concurrency for a `MAX_CONCURRENCY = 5` semaphore. REJECTED dropping failed rows:
`BatchItem` carries either a result or an error, and errors sort first.

**Why:** Retrying a successful-but-mismatching read is shopping for the answer the
applicant wanted, so only provider failures retry — and only with time left in the
five-second budget. A label that could not be read is a service failure, not a
clean review: it returns 502 on the single route and a visible error row in a
batch, because a dropped row means the reviewer silently sees fewer applications
than they selected.
