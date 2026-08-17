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
const PWA_ICON = path.join(
  __dirname,
  "..",
  "public",
  "icons",
  "icon-512-owl-outline.svg"
);

const DENSITIES = [
  ["mdpi", 48],
  ["hdpi", 72],
  ["xhdpi", 96],
  ["xxhdpi", 144],
  ["xxxhdpi", 192],
];

async function main() {
  const svg = fs.readFileSync(PWA_ICON, "utf8");
  for (const [density, px] of DENSITIES) {
    const dir = path.join(RES, `mipmap-${density}`);
    const buf = await sharp(Buffer.from(svg), { density: 96 })
      .resize(px, px, { fit: "fill", kernel: "lanczos3" })
      .png()
      .toBuffer();
    fs.writeFileSync(path.join(dir, "ic_launcher.png"), buf);
    fs.writeFileSync(path.join(dir, "ic_launcher_round.png"), buf);
    console.log(`${density}: ${px}px`);
  }
  console.log("OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});