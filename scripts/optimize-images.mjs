import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const ROOT = process.cwd();
const INPUT_DIR = path.join(ROOT, "images");
const OUTPUT_DIR = path.join(ROOT, "dist");
const MANIFEST_PATH = path.join(OUTPUT_DIR, "manifest.json");

const SUPPORTED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"]);
const WIDTHS = (process.env.IMAGE_WIDTHS ?? "320,640,960,1280")
  .split(",")
  .map((value) => Number.parseInt(value.trim(), 10))
  .filter((value) => Number.isInteger(value) && value > 0)
  .sort((a, b) => a - b);

const MAX_WIDTH = Number.parseInt(process.env.IMAGE_MAX_WIDTH ?? "1600", 10);
const QUALITY = Number.parseInt(process.env.WEBP_QUALITY ?? "82", 10);

if (WIDTHS.length === 0) throw new Error("IMAGE_WIDTHS must contain at least one valid width.");
if (!Number.isInteger(MAX_WIDTH) || MAX_WIDTH < 1) throw new Error("IMAGE_MAX_WIDTH must be a positive integer.");
if (!Number.isInteger(QUALITY) || QUALITY < 1 || QUALITY > 100) throw new Error("WEBP_QUALITY must be between 1 and 100.");

const clean = process.argv.includes("--clean");

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });

  const found = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) found.push(...await walk(absolute));
    else if (entry.isFile() && SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      found.push(absolute);
    }
  }
  return found;
}

async function ensureDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function writeWebp(sourcePath, destinationPath, width) {
  await ensureDir(destinationPath);
  await sharp(sourcePath, { failOn: "error", limitInputPixels: 268402689 })
    .rotate()
    .resize({ width, height: null, fit: "inside", withoutEnlargement: true })
    .webp({ quality: QUALITY, effort: 5, smartSubsample: true })
    .toFile(destinationPath);
}

async function main() {
  if (clean) await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const sources = await walk(INPUT_DIR);
  const manifest = {
    generatedAt: new Date().toISOString(),
    format: "webp",
    quality: QUALITY,
    maxWidth: MAX_WIDTH,
    widths: WIDTHS,
    images: {}
  };

  let processed = 0;
  for (const sourcePath of sources) {
    const relative = path.relative(INPUT_DIR, sourcePath);
    const parsed = path.parse(relative);
    const outputDirectory = path.join(OUTPUT_DIR, parsed.dir);
    const metadata = await sharp(sourcePath, { failOn: "error" }).metadata();

    if (!metadata.width || !metadata.height) {
      console.warn(`Skipping image with missing dimensions: ${relative}`);
      continue;
    }

    const mainWidth = Math.min(metadata.width, MAX_WIDTH);
    const outputNames = new Set();
    const outputs = [];

    const mainName = `${parsed.name}.webp`;
    const mainPath = path.join(outputDirectory, mainName);
    await writeWebp(sourcePath, mainPath, mainWidth);
    outputNames.add(mainName);
    outputs.push({ width: mainWidth, path: path.posix.join(parsed.dir, mainName) });

    for (const width of WIDTHS) {
      if (width >= mainWidth || outputNames.has(`${parsed.name}-${width}.webp`)) continue;
      const fileName = `${parsed.name}-${width}.webp`;
      await writeWebp(sourcePath, path.join(outputDirectory, fileName), width);
      outputNames.add(fileName);
      outputs.push({ width, path: path.posix.join(parsed.dir, fileName) });
    }

    outputs.sort((a, b) => a.width - b.width);
    manifest.images[relative.split(path.sep).join("/")] = {
      width: metadata.width,
      height: metadata.height,
      format: "webp",
      variants: outputs
    };
    processed += 1;
    console.log(`✓ ${relative} -> ${outputs.length} WebP variant(s)`);
  }

  await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  await fs.writeFile(path.join(OUTPUT_DIR, ".nojekyll"), "");
  console.log(`\nProcessed ${processed} image(s). Output: ${path.relative(ROOT, OUTPUT_DIR)}/`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
