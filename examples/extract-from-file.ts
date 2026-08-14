/**
 * Example: extract a local SCORM ZIP.
 *
 *   npx tsx examples/extract-from-file.ts path/to/curso.zip
 */
import { extract, isScormExtractorError } from "../src/index.js";

const path = process.argv[2];
if (!path) {
  console.error("Usage: npx tsx examples/extract-from-file.ts <curso.zip>");
  process.exit(1);
}

try {
  const result = await extract(path, {
    includeBytes: { images: false, pdfs: false, videos: false },
  });
  console.log(
    JSON.stringify(
      {
        format: result.format,
        course: result.course,
        warnings: result.warnings,
        documents: result.documents.map((doc) => ({
          id: doc.id,
          kind: doc.kind,
          position: doc.position,
          textPreview: doc.text.slice(0, 200),
          images: doc.images.length,
          pdfs: doc.pdfs.length,
          videos: doc.videos.length,
        })),
      },
      null,
      2,
    ),
  );
} catch (err) {
  if (isScormExtractorError(err)) {
    console.error(err.code, err.message);
    process.exit(1);
  }
  throw err;
}
