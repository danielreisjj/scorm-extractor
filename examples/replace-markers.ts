/**
 * Example: replace media markers with stub OCR/ASR text.
 * Shows the marker-replacement contract with stub OCR/ASR text.
 *
 *   npx tsx examples/replace-markers.ts path/to/curso.zip
 */
import { extract } from "../src/index.js";

const path = process.argv[2];
if (!path) {
  console.error("Usage: npx tsx examples/replace-markers.ts <curso.zip>");
  process.exit(1);
}

const result = await extract(path, {
  includeBytes: { images: false, pdfs: false, videos: false },
});

for (const doc of result.documents.slice(0, 3)) {
  let text = doc.text;
  for (const image of doc.images) {
    text = text.replaceAll(
      `[${image.ref}]`,
      `[OCR image ${image.filename}]`,
    );
  }
  for (const pdf of doc.pdfs) {
    text = text.replaceAll(`[${pdf.ref}]`, `[OCR pdf ${pdf.filename}]`);
  }
  for (const video of doc.videos) {
    text = text.replaceAll(
      `[${video.ref}]`,
      `[ASR video ${video.title || video.url || video.filename}]`,
    );
  }
  console.log("---", doc.id, doc.kind);
  console.log(text.slice(0, 500));
  console.log();
}
