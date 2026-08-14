import type { ExtractionResult } from "../../src/domain/models.js";
import { toJSON } from "../../src/serialize.js";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { OUTPUT_DIR } from "./sample-packages.js";

/** JSON for inspection: same extract() result via toJSON, without binary payloads. */
export async function writeExtractionOutput(
  name: string,
  result: ExtractionResult,
): Promise<string> {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const slim = toJSON(result, { omitBytes: true });
  const path = join(OUTPUT_DIR, `${name}.json`);
  await writeFile(path, `${JSON.stringify(slim, null, 2)}\n`, "utf8");
  return path;
}
