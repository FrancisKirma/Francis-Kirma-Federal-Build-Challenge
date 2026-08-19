"""Vercel build step: compile the React frontend before the function is bundled.

Vercel installs Python dependencies and then runs this, so the built bundle
exists by the time ``backend.main`` mounts it. The USWDS assets are generated
from node_modules rather than committed, so they are produced here too.
"""

import shutil
import subprocess
import sys
from pathlib import Path

FRONTEND = Path(__file__).parent / "frontend"


def run(*command: str) -> None:
    """Run one build command, failing the deployment if it does not succeed."""
    print(f"$ {' '.join(command)}", flush=True)
    subprocess.run(command, cwd=FRONTEND, check=True)  # noqa: S603


def main() -> int:
    """Install frontend dependencies and build the static bundle."""
    if shutil.which("npm") is None:
        print("npm is not available on the build image", file=sys.stderr)
        return 1

    run("npm", "ci")
    # Copies only the USWDS fonts and images the stylesheet references.
    run("npm", "run", "assets")
    run("npx", "vite", "build")

    dist = FRONTEND / "dist" / "index.html"
    if not dist.exists():
        print(f"build produced no {dist}", file=sys.stderr)
        return 1
    print(f"built {dist.parent}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
