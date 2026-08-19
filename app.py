"""Deployment entrypoint.

The backend's modules import each other as top-level names (``api``, ``services``,
``models``), which works because ``backend/`` is the import root -- pytest sets it
via ``pythonpath`` and mypy via ``mypy_path``. A platform importing this file from
the repository root does not have that root, so it is added here before the app is
imported.

Keeping the fix in one entrypoint avoids rewriting every intra-package import to a
``backend.``-prefixed form, which would buy nothing locally.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "backend"))

from main import app

__all__ = ["app"]
