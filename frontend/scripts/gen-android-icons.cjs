const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const RES = path.join(
  __dirname,
  "..",
  "android",
  "app",
  "src",
  "main",
  "res"
);
const PWA_ICON = path.join(__dirname, "..", "public", "icons", "icon-512-owl-outline.svg");
const OWL_FG = path.join(__dirname, "..", "public", "icons", "icon-owl.svg");

const DENSITIES = [
  ["mdpi", 1],
  ["hdpi", 1.5],
  ["xhdpi", 2],
  ["xxhdpi", 3],
  ["xxxhdpi", 4],
];

const LEGACY_BASE = 48; // dp
const FG_BASE = 108; // dp adaptive icon canvas

// Adaptive icon safe zone is 66/108dp (61%). The owl glyph fills ~94% of the
// 256 canvas at scale 10; scale it down to ~58% so it fits inside the safe
// zone (circular/circle launchers won't crop it).
function owlForegroundSvg() {
  const svg = fs.readFileSync(OWL_FG, "utf8");
  return svg.replace("scale(10.0)", "scale(6.2)");
}

async function render(svg, px) {
  return sharp(Buffer.from(svg), { density: 300 })
    .resize(px, px, { fit: "fill" })
    .png()
    .toBuffer();
}

function pwaIconSvg() {
  return fs.readFileSync(PWA_ICON, "utf8");
}

async function main() {
  for (const [density, scale] of DENSITIES) {
    const dir = path.join(RES, `mipmap-${density}`);
    const legacyPx = Math.round(LEGACY_BASE * scale);
    const fgPx = Math.round(FG_BASE * scale);

    const legacy = await render(pwaIconSvg(), legacyPx);
    const round = await render(pwaIconSvg(), legacyPx);
    const fg = await render(owlForegroundSvg(), fgPx);

    fs.writeFileSync(path.join(dir, "ic_launcher.png"), legacy);
    fs.writeFileSync(path.join(dir, "ic_launcher_round.png"), round);
    fs.writeFileSync(path.join(dir, "ic_launcher_foreground.png"), fg);
    console.log(`${density}: legacy ${legacyPx}px, fg ${fgPx}px`);
  }

  const anydpi = path.join(RES, "mipmap-anydpi-v26");
  const fg432 = await render(owlForegroundSvg(), 432);
  fs.writeFileSync(path.join(anydpi, "ic_launcher_foreground.png"), fg432);
  console.log("anydpi-v26: fg 432px");
  console.log("OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});