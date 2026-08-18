/**
 * Copy the USWDS fonts and images the stylesheet actually references into public/.
 *
 * USWDS ships ~2,500 images and 144 font files; this app uses about 50. Vendoring
 * the whole set put 15 MB of dead assets in the repo, so the set is narrowed here
 * instead. Runs before dev and build; rerun after a USWDS upgrade.
 */
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

const USWDS = "node_modules/@uswds/uswds/dist";
const PUBLIC = "public";

// Only woff2: every browser that runs this app supports it, and the ttf/woff
// duplicates triple the font payload for no one.
const FONT_FORMAT = ".woff2";

const IMAGES = [
  "checkbox-indeterminate.svg",
  "checkbox-indeterminate-alt.svg",
  "correct8.svg",
  "correct8-alt.svg",
  "file.svg",
  "file-excel.svg",
  "file-pdf.svg",
  "file-video.svg",
  "file-word.svg",
  "loader.svg",
  "angle-arrow-down-primary.svg",
  "angle-arrow-down-primary-white.svg",
  "angle-arrow-up-primary.svg",
  "angle-arrow-up-primary-white.svg",
  "close.svg",
  "us_flag_small.png",
  "usa-icons-bg",
  "usa-icons",
  // Deliberately excluded: hero.jpg (143 KB), referenced by the USWDS Hero
  // component's stylesheet but never requested because this app has no Hero.
  // Add it here if one is introduced.
];

for (const family of readdirSync(join(USWDS, "fonts"), { withFileTypes: true })) {
  if (!family.isDirectory()) continue;
  for (const file of readdirSync(join(USWDS, "fonts", family.name))) {
    if (!file.endsWith(FONT_FORMAT)) continue;
    const target = join(PUBLIC, "fonts", family.name, file);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(USWDS, "fonts", family.name, file), target);
  }
}

for (const name of IMAGES) {
  const from = join(USWDS, "img", name);
  if (!existsSync(from)) continue;
  const to = join(PUBLIC, "img", name);
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
}

console.log("USWDS assets copied into public/");
