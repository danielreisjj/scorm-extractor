/**
 * Extract every ZIP in scorms/ to output/<name>.json (no image/PDF bytes).
 *
 *   npm run extract:all
 *
 * Each package is processed in isolation. A failing extract() does not abort
 * the run: the package is skipped (no JSON written) and listed in the summary.
 * Exit 0 if at least one package extracted successfully.
 */
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import {
  extract,
  isScormExtractorError,
  toJSON,
  UnsupportedPackageFormatError,
} from "../src/index.js";

const SCORMS = join(process.cwd(), "scorms");
const OUTPUT = join(process.cwd(), "output");

await mkdir(OUTPUT, { recursive: true });

const files = (await readdir(SCORMS))
  .filter((name) => name.toLowerCase().endsWith(".zip"))
  .sort();

if (files.length === 0) {
  console.error(`No .zip files in ${SCORMS}`);
  process.exit(1);
}

type SkippedPackage = {
  file: string;
  code: string;
  detectedFormat?: string;
};

const skipped: SkippedPackage[] = [];
let extracted = 0;

for (const file of files) {
  const name = basename(file, ".zip");
  const path = join(SCORMS, file);
  process.stdout.write(`Extracting ${file}… `);
  try {
    const result = await extract(path, {
      includeBytes: { images: false, pdfs: false, videos: false },
    });
    const slim = toJSON(result, { omitBytes: true });
    const outPath = join(OUTPUT, `${name}.json`);
    await writeFile(outPath, `${JSON.stringify(slim, null, 2)}\n`, "utf8");
    extracted += 1;
    console.log(
      `ok → ${outPath} (${result.documents.length} screens, ${result.warnings.length} warnings)`,
    );
  } catch (err) {
    const code = isScormExtractorError(err) ? err.code : "UNKNOWN";
    const message = err instanceof Error ? err.message.split("\n")[0]! : String(err);
    console.log(`skip [${code}] ${message}`);

    const entry: SkippedPackage = { file, code };
    if (err instanceof UnsupportedPackageFormatError) {
      entry.detectedFormat = err.detectedFormat;
    }
    skipped.push(entry);
  }
}

console.log("");
console.log(`Done. ${extracted} extracted, ${skipped.length} skipped.`);
if (skipped.length > 0) {
  console.log("Skipped:");
  for (const item of skipped) {
    const format =
      item.detectedFormat !== undefined
        ? ` detectedFormat=${item.detectedFormat}`
        : "";
    console.log(`  - ${item.file} [${item.code}]${format}`);
  }
}

process.exit(extracted > 0 ? 0 : 1);
