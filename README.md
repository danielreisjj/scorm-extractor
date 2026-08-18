# scorm-extractor

Extract linearized screen text and media asset references from SCORM packages.

TypeScript library for Node.js 20+ (ESM). Call `extract()` from your application; OCR, transcription, indexing, and LMS playback stay with the consumer. This is not a player, CLI, or HTTP service.

| | |
| --- | --- |
| Version | `0.5.3` |
| Runtime | Node.js ≥ 20 (ESM) |
| Format | HoApp, AST OnePage |
| License | UNLICENSED |

## Install

Private package — not published to the public npm registry. Requires a built package (`npm run build` → `dist/`):

```bash
npm install github:danielreisjj/scorm-extractor
```

SSH equivalent: `npm install git+ssh://git@github.com:danielreisjj/scorm-extractor.git`
## Usage

```ts
import { extract, toJSON, ErrorCode, isScormExtractorError } from "scorm-extractor";

const result = await extract("./course.zip");
// Path, file: URL, Uint8Array, or Buffer. Wrap ArrayBuffer: new Uint8Array(buf)
// Default: no media bytes — originalPath + bytesStatus: "omitted"

const json = toJSON(result);
// Raw `bytes` is Uint8Array | null. toJSON encodes loaded payloads as { encoding: "base64", data }.

for (const doc of result.documents) {
  // Markers in text align with arrays on the same screen
  console.log(doc.id, doc.kind, doc.text);
}
```

## Options

| Option | Default | Description |
| --- | --- | --- |
| `includeBytes.images` | `false` | Populate `images[].bytes` |
| `includeBytes.pdfs` | `false` | Populate `pdfs[].bytes` |
| `includeBytes.videos` | `false` | Populate local `videos[].bytes` |
| `maxUncompressedBytes` | `512 MiB` | Reject packages that exceed the uncompressed ZIP limit |

## Output

One entry in `documents[]` per screen, in package order. Media are represented as markers in `text` (`[IMAGE_n]`, `[PDF_n]`, `[VIDEO_n]`); matching assets live in that screen’s `images` / `pdfs` / `videos` arrays. Indices restart at `0` on every screen. Marker and `ref` stay in 1:1 correspondence.

Documents with `kind: "quiz"` also include a structured `quiz` field (`questions[]` with SCORM interaction `type`, `question`, optional `context`, `responses`, `feedback`). Linearized `text` is unchanged. Today only `type: "choice"` is fully structured; other authoring types become `type: "other"` and a `unsupported_quiz_type` warning. Missing answer keys set every `correct` to `false` and emit `quiz_missing_answer_key`. Packages with 4+ screens and almost no useful text (markers stripped, mean below 40 characters per screen) emit `suspicious_empty_extraction`. Monitor those codes on `result.warnings` (they are prefixes: `warning.startsWith(WarningCode.UNSUPPORTED_QUIZ_TYPE)`).

```ts
for (const doc of result.documents) {
  if (doc.kind !== "quiz") continue;
  for (const q of doc.quiz.questions) {
    const chunk = [q.context, q.question, ...q.responses.map((r) => r.text)].filter(Boolean).join("\n");
    // one retrieval chunk per question — do not split doc.text on delimiters
  }
}
```

Each image also has `width`, `height`, and `byteSize` (file size in the ZIP, not base64). They are filled even when `bytes` is omitted. The library does **not** filter or crop images — it only exposes those numbers so you can apply your own discard policy before OCR:

```ts
const forOcr = doc.images.filter((image) => {
  if (image.width !== null && image.height !== null && image.width < 32 && image.height < 32) {
    return false;
  }
  if (image.byteSize !== null && image.byteSize < 2_000) return false;
  return true;
});
```

### Media bytes

Assets can be consumed **without** binary payloads (the default: path inside the ZIP) or **with** them (`Uint8Array` on the result, then base64 only in JSON). Metadata is always present: `filename`, `mimeType`, `bytesStatus`, and `originalPath` (path inside the ZIP; `null` on remote videos). Images also have `width`, `height`, and `byteSize` even when bytes are not included.

**Without bytes (default).** `extract()` does not load payloads. `bytes` is `null` and `bytesStatus` is `"omitted"` when the file exists:

```ts
const result = await extract("./course.zip");
const json = toJSON(result); // no { encoding: "base64", data }

for (const doc of result.documents) {
  for (const image of doc.images) {
    // image.originalPath — e.g. "midias/imagens/foto.png"; open the ZIP and read that entry
  }
  for (const pdf of doc.pdfs) {
    // pdf.originalPath
  }
}
```

`bytesStatus: "omitted"` means the file exists and bytes were not requested — the expected status in this mode. Use `originalPath` to locate the file in the package for OCR, transcription, or anything else.

`includeBytes` controls whether `extract()` fills `bytes` with a `Uint8Array`. `omitBytes` only affects `toJSON()`: it drops payloads from JSON and leaves `bytesStatus` unchanged. Add `omitBytes: true` when serializing a result that already has bytes.

**With bytes.** Pass `includeBytes` explicitly. Loaded `bytes` on the result are `Uint8Array`, not a base64 string. `toJSON(result)` is what encodes those payloads as `{ encoding: "base64", data }`.

```ts
const result = await extract("./course.zip", {
  includeBytes: { images: true, pdfs: true, videos: false },
});
const json = toJSON(result); // Uint8Array → { encoding: "base64", data }
```

Enable `includeBytes.videos` only for local files; Vimeo/YouTube stay `bytes: null` with a `url`.

| `bytesStatus` | Meaning |
| --- | --- |
| `present` | Bytes were loaded |
| `omitted` | File is in the ZIP; bytes were not requested |
| `missing` | File is not in the ZIP |
| `remote` | Hosted video (Vimeo/YouTube); use `url` |

Contract details, field notes, and consumer patterns: [docs/guide.md](docs/guide.md).

## Supported formats

| Format | Status |
| --- | --- |
| HoApp (`js/data.js` / `as-course`) | Supported |
| AST OnePage (`ast_onepage_actions.js` + `resources/mN/index.html`) | Supported |
| Storyline, Rise, Captivate, other | Throws `UnsupportedPackageFormatError` with `detectedFormat` |

## Errors

Failures throw a `ScormExtractorError` subclass with a stable `code`:

`INVALID_INPUT` · `IO_FAILURE` · `INVALID_PACKAGE` · `PACKAGE_TOO_LARGE` · `UNSAFE_ZIP_PATH` · `UNSUPPORTED_PACKAGE_FORMAT`

```ts
try {
  await extract(source);
} catch (err) {
  if (isScormExtractorError(err) && err.code === ErrorCode.UNSUPPORTED_PACKAGE_FORMAT) {
    // unsupported authoring format
  }
  throw err;
}
```

## Documentation

- [Consumer guide](docs/guide.md) — output shape, markers, bytes, warnings
- [Architecture](docs/architecture.md) — layers and adding parsers
- [Changelog](CHANGELOG.md)

## License

UNLICENSED
