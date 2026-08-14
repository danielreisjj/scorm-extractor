/**
 * Example: serialize extract() output for JSON transport.
 *
 *   npx tsx examples/to-json.ts path/to/curso.zip
 */
import { writeFile } from "node:fs/promises";
import { extract, toJSON } from "../src/index.js";

const path = process.argv[2];
if (!path) {
  console.error("Usage: npx tsx examples/to-json.ts <curso.zip>");
  process.exit(1);
}

const result = await extract(path, {
  includeBytes: { images: true, pdfs: false, videos: false },
});

const json = toJSON(result, { omitBytes: false });
const out = "extraction.json";
await writeFile(out, `${JSON.stringify(json, null, 2)}\n`, "utf8");
console.log(`Wrote ${out} (${result.documents.length} documents)`);
