## 2026-08-18 — Vision extraction: image downscaling and warning fidelity

**Asked:** Add `backend/extraction.py` — one `extract` entry point, provider
chosen by `AI_PROVIDER`, structured output, and image preprocessing to keep the
per-label call inside the five-second budget.

**Produced:** OpenAI and Anthropic adapters over httpx, plus a `preprocess` step
that downscaled artwork to a 512px longest edge "to cut tokens and latency," and
a prompt instructing the model to return the statutory warning.

**Accepted / Rejected:** Accepted the adapters, the httpx transport, and the
trust-boundary rejections in `preprocess` (animated, oversized, unsupported,
decompression bombs). REJECTED the 512px edge — `MAX_IMAGE_EDGE` is 1024.
REJECTED the prompt wording, which now says never to reconstruct or repair the
warning from memory, and to ignore instructions printed in the image.

**Why:** At 512px the 11px warning text stopped resolving and the model correctly
returned null, turning compliant labels into false "unreadable" — cheaper and
faster, wrong on the field that matters most. A model that recalls the statutory
text instead of transcribing it will pass a label whose warning was altered,
which is the exact failure this tool exists to catch. Both are pinned by tests
(`test_fixture_labels_are_not_downscaled`,
`test_title_case_warning_not_corrected`).
