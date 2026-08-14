/**
 * Extract every ZIP in scorms/ to output/<name>.json (no image/PDF bytes).
 *
 *   npm run extract:all
 */
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { extract, toJSON } from "../src/index.js";

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

for (const file of files) {
  const name = basename(file, ".zip");
  const path = join(SCORMS, file);
  process.stdout.write(`Extracting ${file}… `);
  const result = await extract(path, {
    includeBytes: { images: false, pdfs: false, videos: false },
  });
  const slim = toJSON(result, { omitBytes: true });
  const outPath = join(OUTPUT, `${name}.json`);
  await writeFile(outPath, `${JSON.stringify(slim, null, 2)}\n`, "utf8");
  console.log(
    `ok → ${outPath} (${result.documents.length} screens, ${result.warnings.length} warnings)`,
  );
}

console.log(`Done. ${files.length} package(s) in ${OUTPUT}`);
