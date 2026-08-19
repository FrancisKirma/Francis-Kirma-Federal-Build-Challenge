"""Render the fixture label artwork from applications.json.

Run by hand; the PNGs are committed. This is not a build step and nothing in the
app imports it -- it exists so the test data is auditable and regenerable.

    python3 tools/generate_labels.py [--only TTB-2024-0044] [--open]

Labels are rendered from ``_label_truth.printed``, never from ``submitted``. That
is the whole design: the applicant's claim and the printed artwork are allowed to
disagree, and those disagreements are what the tool is being tested against.
"""

import argparse
import html
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any, Final

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from constants import WARNING_VARIANTS
from repositories.applications import current_version, version_dir

TEMPLATE: Final = Path(__file__).with_name("label_template.html")
PANEL: Final = (600, 800)

# Chrome's --screenshot is used over Playwright: no 130MB Chromium download and no
# new dependency for what a subprocess call already does. The flag is soft-
# deprecated in favour of --headless=new, so Playwright is the fallback if it is
# ever removed.
CHROME_CANDIDATES: Final = (
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "google-chrome",
    "chromium",
)

# Each style is a block of CSS custom properties. Faces are macOS system fonts;
# verify_fonts() fails loudly rather than letting a substitution silently change
# what the vision model sees.
STYLES: Final[dict[str, dict[str, str]]] = {
    "serif-cream": {
        "--bg": "#f4ecd8", "--ink": "#2b1d0e", "--accent": "#8a7a5c",
        "--display-font": "Baskerville, Georgia, serif",
        "--body-font": "Baskerville, Georgia, serif",
        "--brand-size": "50px", "--brand-tracking": ".06em",
    },
    "sans-slate": {
        "--bg": "#2f3640", "--ink": "#eef1f4", "--accent": "#7d8794",
        "--display-font": "Futura, 'Helvetica Neue', sans-serif",
        "--body-font": "Futura, 'Helvetica Neue', sans-serif",
        "--brand-size": "44px", "--brand-tracking": ".14em",
        "--class-style": "normal", "--class-size": "19px",
        "--warning-font": "'Helvetica Neue', Helvetica, sans-serif",
    },
    "serif-black": {
        "--bg": "#111014", "--ink": "#e8dcc0", "--accent": "#b8933f",
        "--display-font": "Didot, 'Bodoni 72', serif",
        "--body-font": "Didot, 'Bodoni 72', serif",
        "--brand-size": "54px", "--brand-tracking": ".04em",
        "--brand-ink": "#d9b869", "--rule-width": "40%",
    },
    "sans-navy": {
        "--bg": "#1b2a4a", "--ink": "#f2ede1", "--accent": "#9aa8c4",
        "--display-font": "Optima, 'Gill Sans', sans-serif",
        "--body-font": "Optima, 'Gill Sans', sans-serif",
        "--brand-size": "48px", "--brand-tracking": ".10em",
        "--class-style": "normal",
        "--warning-font": "'Helvetica Neue', Helvetica, sans-serif",
    },
    "serif-gold": {
        "--bg": "#fbf7ec", "--ink": "#3a2f1b", "--accent": "#a98b3c",
        "--display-font": "'Bodoni 72', Didot, serif",
        "--body-font": "'Bodoni 72', Didot, serif",
        "--brand-size": "52px", "--brand-tracking": ".08em",
        "--brand-ink": "#8a6d24", "--rule-width": "62%",
    },
    "sans-forest": {
        "--bg": "#1e3226", "--ink": "#f0ead6", "--accent": "#8fa88d",
        "--display-font": "Copperplate, 'Gill Sans', sans-serif",
        "--body-font": "'Gill Sans', sans-serif",
        "--brand-size": "40px", "--brand-tracking": ".16em",
        "--class-style": "normal", "--class-size": "18px",
        "--warning-font": "'Helvetica Neue', Helvetica, sans-serif",
    },
}

# TTB-2024-0047: angled, dimmed, glare. Kept mild deliberately -- the record expects
# every field to match, including the byte-for-byte warning, so distortion severe
# enough to flake would read as a tool bug rather than as robustness. The highlight
# sits high-left, away from the warning panel at the foot.
DISTORTION: Final = """
  body { background: #15130f; }
  .label {
    transform: perspective(1300px) rotateY(8deg) rotateZ(-1.8deg) scale(.93);
    transform-origin: 50% 45%;
    /* Uneven lighting: brighter top-left falling off to the lower right, which is
       what an angled handheld shot under one light source actually looks like. */
    filter: brightness(.82) contrast(1.06) saturate(.94);
    box-shadow: 0 18px 40px rgba(0,0,0,.55);
  }
  .label::after {
    content: ""; position: absolute; inset: 0; pointer-events: none;
    background:
      radial-gradient(ellipse 40% 22% at 28% 20%,
        rgba(255,253,244,.60) 0%, rgba(255,253,244,.22) 46%, transparent 74%),
      linear-gradient(118deg,
        rgba(255,255,255,.10) 0%, transparent 38%, rgba(0,0,0,.20) 100%);
  }
  .label { position: relative; }
"""


# TTB-2024-0049: a photograph taken out of focus. Strong enough that the small
# print genuinely cannot be read, while the brand and class remain legible --
# the realistic case where an agent gets a partial reading rather than nothing,
# and has to decide on incomplete evidence.
BLUR: Final = """
  body { background: #1a1a1a; }
  .label {
    filter: blur(3.2px) brightness(.94) contrast(.92);
    transform: scale(.97);
  }
  .label::after {
    content: ""; position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(150deg,
      rgba(255,255,255,.12) 0%, transparent 45%, rgba(0,0,0,.18) 100%);
  }
  .label { position: relative; }
"""


# TTB-2024-0050: a photograph that failed. Heavy blur, near-darkness and a
# blown-out reflection across the panel, so no field can be read at all -- the
# case where the tool must return null everywhere rather than guess, and the
# agent has to ask for a resubmission.
UNREADABLE: Final = """
  body { background: #0a0a0a; }
  .label {
    filter: blur(11px) brightness(.34) contrast(.55) saturate(.6);
    transform: perspective(900px) rotateY(19deg) rotateZ(-4deg) scale(.82);
  }
  .label::after {
    content: ""; position: absolute; inset: 0; pointer-events: none;
    background:
      radial-gradient(ellipse 70% 46% at 44% 42%,
        rgba(255,255,255,.62) 0%, rgba(255,255,255,.30) 52%, transparent 82%),
      linear-gradient(160deg, rgba(0,0,0,.55) 0%, transparent 40%,
        rgba(0,0,0,.72) 100%);
  }
  .label { position: relative; }
"""


def find_chrome() -> str:
    """Locate a Chrome binary. CHROME overrides for non-macOS checkouts."""
    override = os.environ.get("CHROME")
    if override:
        return override
    for candidate in CHROME_CANDIDATES:
        if Path(candidate).exists():
            return candidate
        found = shutil.which(candidate)
        if found:
            return found
    msg = "no Chrome/Chromium found; set CHROME=/path/to/binary"
    raise FileNotFoundError(msg)


def verify_fonts() -> list[str]:
    """Report any style face missing from the system font library.

    A silent substitution changes what the model reads while the JSON still claims
    the old answer, so this is worth knowing before rendering, not after.
    """
    roots = (
        Path("/System/Library/Fonts"),
        Path("/Library/Fonts"),
        Path.home() / "Library/Fonts",
    )
    available = {
        f.stem.split()[0].lower()
        for root in roots
        if root.is_dir()
        for f in root.rglob("*")
        if f.suffix.lower() in {".ttf", ".ttc", ".otf"}
    }
    wanted = {"baskerville", "futura", "didot", "optima", "bodoni", "copperplate"}
    return sorted(w for w in wanted if w not in available)


def warning_block(variant: str) -> str:
    """Return the warning element, or nothing when the label carries no warning."""
    text = WARNING_VARIANTS[variant]
    if text is None:
        # 0048: composed without the element, so the panel reads as a label designed
        # without a warning rather than one with a hole in it.
        return ""
    return f'<div class="warning">{html.escape(text)}</div>'


def render_html(record: dict[str, Any]) -> str:
    """Fill the template from one record's printed (not submitted) values."""
    truth = record["_label_truth"]
    printed = truth["printed"]
    style = STYLES[truth["style"]]

    page = TEMPLATE.read_text()
    variables = "\n    ".join(f"{k}: {v};" for k, v in style.items())
    page = page.replace("{{STYLE_VARS}}", variables)
    for key, placeholder in (
        ("brand_name", "{{BRAND_NAME}}"),
        ("class_type", "{{CLASS_TYPE}}"),
        ("alcohol_content", "{{ALCOHOL_CONTENT}}"),
        ("net_contents", "{{NET_CONTENTS}}"),
    ):
        page = page.replace(placeholder, html.escape(str(printed[key])))
    warning = warning_block(printed["government_warning"])
    page = page.replace("{{WARNING_BLOCK}}", warning)

    post = truth.get("post_process")
    if post == "angled_glare":
        page = page.replace("</style>", DISTORTION + "</style>")
    elif post == "out_of_focus":
        page = page.replace("</style>", BLUR + "</style>")
    elif post == "unreadable":
        page = page.replace("</style>", UNREADABLE + "</style>")

    if "{{" in page:
        leftover = page[page.index("{{"): page.index("{{") + 40]
        msg = f"unsubstituted placeholder in template: {leftover!r}"
        raise ValueError(msg)
    return page


def shoot(chrome: str, page: str, out: Path) -> None:
    """Rasterise one page to PNG via headless Chrome."""
    with tempfile.TemporaryDirectory() as tmp:
        source = Path(tmp) / "label.html"
        source.write_text(page)
        subprocess.run(  # noqa: S603  (fixed argv, paths are ours)
            [
                chrome, "--headless", "--disable-gpu", "--hide-scrollbars",
                "--no-first-run", "--no-default-browser-check",
                f"--screenshot={out}", f"--window-size={PANEL[0]},{PANEL[1]}",
                source.as_uri(),
            ],
            check=True, capture_output=True, timeout=45,
        )
    if not out.exists() or out.stat().st_size == 0:
        msg = f"chrome produced no output for {out.name}"
        raise RuntimeError(msg)


def main() -> int:
    """Render every fixture label, or just the one named by --only."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--only", help="render a single application_id")
    args = parser.parse_args()

    missing = verify_fonts()
    if missing:
        print(f"warning: fonts not found, Chrome will substitute: {', '.join(missing)}")

    chrome = find_chrome()
    directory = version_dir()
    records = json.loads((directory / "applications.json").read_text())
    if args.only:
        records = [r for r in records if r["application_id"] == args.only]
        if not records:
            print(f"no such application_id: {args.only}")
            return 1

    labels = directory / "labels"
    labels.mkdir(exist_ok=True)

    for record in records:
        out = directory / record["artwork"]
        shoot(chrome, render_html(record), out)
        note = record["_label_truth"]["condition"].split(".")[0]
        size_kb = out.stat().st_size // 1024
        print(f"  {out.name}  {size_kb:>4} KB   {note}")

    print(f"rendered {len(records)} label(s) into {current_version()}/labels/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
