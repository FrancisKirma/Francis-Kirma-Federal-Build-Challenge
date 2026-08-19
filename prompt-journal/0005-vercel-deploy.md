## 2026-08-19 — Vercel deploy: import root and frontend serving

**Asked:** Make the app deployable on Vercel — one Python function serving the
API, the built React bundle served alongside it, and the frontend built during
deployment.

**Produced:** `vercel.json`, a `build.py` build step, and a suggestion to rewrite
every intra-package import to a `backend.`-prefixed form so `backend.main` could
be the entrypoint. The frontend was to be served with
`app.mount("/", StaticFiles(directory=dist, html=True))`.

**Accepted / Rejected:** Accepted `vercel.json` and `build.py`. REJECTED the
import rewrite — `app.py` inserts `backend/` on `sys.path` and re-exports the
app, leaving every module import unchanged. REJECTED the `StaticFiles` mount for
`app.frontend("/", directory=...)`. Added `excludeFiles` to keep tests, tools,
and `node_modules` out of the function bundle, and `tests/test_deployment.py`
including a check that no `.env` is tracked.

**Why:** The prefix rewrite touched every file in `backend/` to satisfy one
platform, when a four-line entrypoint gives the same import root that pytest and
mypy already provide. `app.frontend()` registers the bundle as low-priority routes
with SPA fallback, so `/api` cannot be shadowed by a mount ordering mistake. The
deployment tests exist because a broken entrypoint fails the deploy rather than
the suite — that is the wrong place to find out.
