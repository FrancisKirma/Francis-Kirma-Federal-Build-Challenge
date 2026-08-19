"""Deployment shape.

These assert the things that only break once the app is imported the way a
platform imports it -- from the repository root, without the sys.path the test
runner provides. A broken entrypoint fails the deploy, not the suite, so it is
worth catching here.
"""

import json
import subprocess
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_entrypoint_imports_from_the_repository_root() -> None:
    """`from app import app` must work with no path help, as Vercel does it."""
    result = subprocess.run(
        [sys.executable, "-c", "from app import app; print(len(app.routes))"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr


def test_vercel_entrypoint_matches_the_file_that_exists() -> None:
    config = tomllib.loads((ROOT / "pyproject.toml").read_text())
    entrypoint = config["tool"]["vercel"]["entrypoint"]
    module = entrypoint.split(":")[0]
    assert (ROOT / f"{module.replace('.', '/')}.py").exists()


def test_function_config_names_the_entrypoint_file() -> None:
    """A functions key that names no real file is silently ignored."""
    vercel = json.loads((ROOT / "vercel.json").read_text())
    for path in vercel.get("functions", {}):
        assert (ROOT / path).exists(), f"vercel.json points at missing {path}"


def test_build_script_exists_and_is_runnable() -> None:
    config = tomllib.loads((ROOT / "pyproject.toml").read_text())
    build = config["tool"]["vercel"]["scripts"]["build"]
    script = build.split()[-1]
    assert (ROOT / script).exists()


def test_secrets_are_not_committed() -> None:
    """A key in the repository is the one deployment mistake with no undo."""
    tracked = subprocess.run(
        ["git", "ls-files"],  # noqa: S607
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    ).stdout.split()
    assert ".env" not in tracked
    leaked = [
        name
        for name in tracked
        if name.startswith(".env.") and name != ".env.example"
    ]
    assert leaked == []
