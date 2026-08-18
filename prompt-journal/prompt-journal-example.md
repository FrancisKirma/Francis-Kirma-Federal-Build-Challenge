## 2026-08-18 — Scaffold config.toml

**Asked:** /plan a config.toml setting model_reasoning_effort=medium,
sandbox_mode=workspace-write, approval_policy=on-request.

**Produced:** A config.toml with those four keys, plus an extra
`approval_policy = "never"` it suggested "for speed".

**Accepted / Rejected:** Accepted the four keys. REJECTED the
`never` suggestion.

**Why:** `never` removes the human approval gate, which violates our
federal posture on day one. Kept `on-request` so destructive and network
actions still pause for a human.