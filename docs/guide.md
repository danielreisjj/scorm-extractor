# Guide

Canonical English reference for consumers and maintainers. Start with the [README](../README.md) programmatic usage; use this file for contract details.

## What this library does

`extract(source)` opens a SCORM ZIP and returns:

- `course` metadata
- `documents[]` — one entry per screen, in order
- linearized `text` with media markers
- parallel arrays `images` / `pdfs` / `videos` whose `ref` values match those markers

OCR, transcription, quiz scoring, and playback stay with the consumer.

## Output shape

```ts
{
  schemaVersion: 1,
  format: "hoapp" | "ast-onepage" | string,
  warnings: string[],
  course: { title, code, language },
  documents: [{
    id: "tela_09",
    position: 8,
    kind: "screen" | "quiz",
    text: "…\n\n[PDF_0]\n\n…",
    images: [{ ref, mimeType, originalPath, filename, alt, width, height, byteSize, bytes, bytesStatus }],
    pdfs:   [{ ref, mimeType, originalPath, filename, bytes, bytesStatus }],
    videos: [{ ref, source, mimeType, originalPath, filename, url, title, bytes, bytesStatus }],
  }]
}
```

`schemaVersion` versions this output contract (not the npm package semver). Breaking changes to the result shape increment it.

### Markers (per screen)

- Literals: `[IMAGE_0]`, `[PDF_0]`, `[VIDEO_0]`
- Index starts at **0 on every screen** (not global across the package)
- Invariant: every marker in `text` has exactly one matching `ref` in that screen's arrays, and vice versa

### Field notes

| Field | Meaning |
| --- | --- |
| `originalPath` | Path **inside the ZIP**, never a public URL |
| `filename` | Basename |
| `images[].width` / `height` | Pixel size from the file header (`null` if unread) |
| `images[].byteSize` | File size in the ZIP in bytes (`null` if the file is missing). Independent of `bytes` / `includeBytes` |
| `bytes` | `Uint8Array \| null` according to `includeBytes` |
| `bytesStatus` | `present` \| `omitted` \| `missing` \| `remote` — why `bytes` is filled or null |
| `images[].alt` | HTML `alt` (often empty) |
| `videos[].source` | `vimeo` \| `youtube` \| `local` |
| `videos[].mimeType` | Local file MIME (e.g. `video/mp4`); `null` when remote |
| `kind` | `quiz` if Assessment/Question (HoApp) or `quiz/*.json` (AST OnePage) is present; else `screen` |

Intentionally omitted: `documents[].title` (already in `text`), `images[].role` (chrome files are filtered out).

### Image metadata (no filtering)

Every `images[]` entry includes `filename`, `width`, `height`, and `byteSize`. Pixel size is read from PNG/JPEG/GIF/WebP headers while parsing the ZIP; `byteSize` is the file length inside the package (not the base64 payload). These fields are filled even when `bytesStatus` is `"omitted"` (`includeBytes.images: false` / `extract:all`).

This library does **not** filter, crop, or drop images by size. It only exposes the numbers so the consumer can apply their own policy (for example skip small icons before OCR). Unsupported or corrupt headers leave `width`/`height` as `null` and may add a warning.

### Kept vs omitted content

- **Kept:** UI copy (“Clique para baixar”, “Download”, “Iniciar”), quiz prompts, correct-answer labels when present in package data
- **Omitted (player chrome files):** `midias/interface/`, `resources/interface/`, `bg/`, fonts, `img-logo`

### Bytes: when filled vs null

| Call | `images[].bytes` | `pdfs[].bytes` | `videos[].bytes` |
| --- | --- | --- | --- |
| `extract(zip)` defaults | filled | filled | `null` (unless `includeBytes.videos: true` and local file) |
| `toJSON(result, { omitBytes: true })` | omitted in JSON | omitted in JSON | omitted in JSON |

Use default `extract()` (or enable `includeBytes`) when you need binary payloads for OCR. Remote videos (Vimeo/YouTube) always have `bytes: null` and a `url`. `width` / `height` / `byteSize` on images do not depend on this table.

### JSON transport

`JSON.stringify(Uint8Array)` is useless. Use:

```ts
import { toJSON, fromJSON } from "scorm-extractor";
const payload = toJSON(result);
// bytes → { encoding: "base64", data: string } | null

const slim = toJSON(result, { omitBytes: true }); // inspection / logs
const restored = fromJSON(payload); // base64 → Uint8Array
```

## Options

```ts
await extract(zip, {
  includeBytes: { images: true, pdfs: true, videos: false },
  maxUncompressedBytes: 512 * 1024 * 1024,
});
```

## Errors vs warnings

Failures **throw** a `ScormExtractorError` subclass with stable `code`:

| Code | Class | When |
| --- | --- | --- |
| `INVALID_INPUT` | `InvalidInputError` | Bad options / source type |
| `IO_FAILURE` | `IoError` | File missing / permissions |
| `INVALID_PACKAGE` | `InvalidPackageError` | Corrupt ZIP, missing data.js, … |
| `PACKAGE_TOO_LARGE` | `PackageTooLargeError` | Over size limit |
| `UNSAFE_ZIP_PATH` | `UnsafeZipPathError` | Zip-slip |
| `UNSUPPORTED_PACKAGE_FORMAT` | `UnsupportedPackageFormatError` | Not HoApp/AST OnePage; see `detectedFormat` |

Soft issues go to `result.warnings[]`. Extraction **continues**. Known warnings today:

| Warning | Meaning |
| --- | --- |
| `course.title looks like a leftover template` | `iCourse.title` barely appears in screen content (e.g. Novo_CIEVO_M01 titled as another course). Use screen text / your CMS title; do not trust `course.title` blindly. |
| `Missing image '…' in tela_X` | Marker references a path not present in the ZIP; `bytes` stays `null`. |
| `Missing PDF '…' in tela_X` | Same for PDF. |
| `Could not read image dimensions for '…' in tela_X` | File exists but PNG/JPEG/GIF/WebP header could not be parsed; `width`/`height` stay `null`. |

```ts
import { extract, ErrorCode, isScormExtractorError } from "scorm-extractor";

try {
  await extract("curso.zip");
} catch (err) {
  if (isScormExtractorError(err) && err.code === ErrorCode.UNSUPPORTED_PACKAGE_FORMAT) {
    // Storyline / Rise / Captivate / unknown
  }
  throw err;
}
```

## Formats

SCORM is an envelope. Content lives in the authoring export.

| Format | Today | Behavior |
| --- | --- | --- |
| HoApp (dialects A & B) | Supported | Full extract |
| AST OnePage | Supported | Full extract (`div#cN` screens; optional `quiz/*.json`) |
| Storyline | Not parsed | Error + `detectedFormat: "storyline"` |
| Rise | Not parsed | `detectedFormat: "rise"` |
| Captivate | Not parsed | `detectedFormat: "captivate"` |
| Other | Not parsed | `detectedFormat: "unknown"` |

Adding a new format = new parser + registry entry; **same** `extract()` and markers. See [architecture.md](architecture.md).

## Consumer-side integration

```ts
const result = await extract(zipPath);

for (const doc of result.documents) {
  let text = doc.text;
  for (const image of doc.images) {
    // The library does not filter or crop. Drop tiny icons before OCR yourself:
    const tooSmall =
      image.width !== null &&
      image.height !== null &&
      image.width < 32 &&
      image.height < 32;
    const tooLight = image.byteSize !== null && image.byteSize < 2_000;
    if (tooSmall || tooLight) {
      text = text.replaceAll(`[${image.ref}]`, "");
      continue;
    }
    text = text.replaceAll(`[${image.ref}]`, await ocrImage(image.bytes));
  }
  for (const pdf of doc.pdfs) {
    text = text.replaceAll(`[${pdf.ref}]`, await ocrPdf(pdf.bytes));
  }
  for (const video of doc.videos) {
    text = text.replaceAll(`[${video.ref}]`, await transcribe(video));
  }
  await upsertChunks(text, { screenId: doc.id, kind: doc.kind });
}
```

Strip UI phrases in **your** own processing if you want — this library stays agnostic.

## Testing

```bash
npm test   # unit + integration (integration cases may skip when fixtures are absent)
npm run lint
npm run build
```
