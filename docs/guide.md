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
  schemaVersion: 2,
  format: "hoapp" | "ast-onepage" | string,
  warnings: string[],
  course: { title, code, language },
  documents: [{
    id: "tela_09",
    position: 8,
    kind: "screen" | "quiz",
    text: "…\n\n[PDF_0]\n\n…",
    quiz?: {                    // only when kind === "quiz"
      questions: [{
        type: "choice" | "true-false" | "fill-in" | "long-fill-in"
            | "matching" | "sequencing" | "likert" | "numeric" | "other",
        question: string,       // prompt (SCORM "description")
        context: string | null, // preceding story/case, when present
        responses: [{ text: string, correct: boolean }],
        feedback: { correct: string | null, incorrect: string | null } | null,
      }],
    },
    images: [{ ref, mimeType, originalPath, filename, alt, width, height, byteSize, bytes, bytesStatus }],
    pdfs:   [{ ref, mimeType, originalPath, filename, bytes, bytesStatus }],
    videos: [{ ref, source, mimeType, originalPath, filename, url, title, bytes, bytesStatus }],
  }]
}
```

`schemaVersion` versions this output contract (not the npm package semver). It increments when the result shape changes (including additive fields).

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
| `quiz` | Structured questions. **Present only when `kind === "quiz"`.** `text` stays linearized for consumers that do not need structure. |

Intentionally omitted: `documents[].title` (already in `text`), `images[].role` (chrome files are filtered out).

### Quiz (`documents[].quiz`)

`quiz` is additive. Do not split `text` on delimiters to recover questions — iterate `doc.quiz.questions`.

`type` uses the SCORM CMI interaction vocabulary (`choice`, `true-false`, `fill-in`, `long-fill-in`, `matching`, `sequencing`, `likert`, `numeric`, `other`). The schema accepts every value. Parsers only **structure** `choice` (multiple choice) today, which is the type present in available packages (AST OnePage `quiz-*.json` / HoApp Question choices). Any other authoring type is emitted as `type: "other"` with as much raw `question` / `context` / `responses` text as can be recovered, plus `unsupported_quiz_type`.

Answer keys from authoring tools (`correct`/`incorrect`, `1`/`0`, `right_answer` vs option `value`, …) are normalized to `responses[].correct: boolean`. When no key is identifiable, questions are still extracted, every `correct` is `false`, and `quiz_missing_answer_key` is emitted. Missing keys are not errors.

Image markers on a quiz screen (`[IMAGE_n]` + `images[]`) are unchanged; `quiz` does not replace them.

```ts
import { extract, WarningCode } from "scorm-extractor";

const result = await extract(zipPath);

for (const warning of result.warnings) {
  if (warning.startsWith(WarningCode.UNSUPPORTED_QUIZ_TYPE)) {
    // question fell through to type: "other" — do not treat it as structured choice
  }
  if (warning.startsWith(WarningCode.QUIZ_MISSING_ANSWER_KEY)) {
    // responses.correct is false for every option; do not score from this quiz
  }
  if (warning.startsWith(WarningCode.SUSPICIOUS_EMPTY_EXTRACTION)) {
    // many screens, almost no useful text — likely a missed dialect, not an empty course
  }
}

for (const doc of result.documents) {
  if (doc.kind !== "quiz") continue;
  for (const q of doc.quiz.questions) {
    const answers = q.responses
      .map((r) => `${r.correct ? "[correct] " : ""}${r.text}`)
      .join("\n");
    const chunk = [q.context, q.question, answers].filter(Boolean).join("\n\n");
    await upsertChunks(chunk, { screenId: doc.id, kind: doc.kind });
  }
}
```

### Image metadata (no filtering)

Every `images[]` entry includes `filename`, `width`, `height`, and `byteSize`. Pixel size is read from PNG/JPEG/GIF/WebP headers while parsing the ZIP; `byteSize` is the file length inside the package (not the base64 payload). These fields are filled even when `bytesStatus` is `"omitted"` (`includeBytes.images: false` / `extract:all`).

This library does **not** filter, crop, or drop images by size. It only exposes the numbers so the consumer can apply their own policy (for example skip small icons before OCR). Unsupported or corrupt headers leave `width`/`height` as `null` and may add a warning.

### Kept vs omitted content

- **Kept:** UI copy (“Clique para baixar”, “Download”, “Iniciar”), quiz prompts, correct-answer labels when present in package data
- **Omitted (player chrome files):** `midias/interface/`, `resources/interface/`, `bg/`, fonts, `img-logo`

### Bytes: when filled vs null

`includeBytes` on `extract()` controls whether `bytes` is a `Uint8Array` (never a base64 string). Defaults are all `false`: path-only consumers call `extract(zip)` and use `originalPath` to read the file from the ZIP. `toJSON()` encodes loaded `Uint8Array` payloads as `{ encoding: "base64", data }`. `toJSON(..., { omitBytes: true })` drops payloads from JSON without changing `bytesStatus`.

| Call | `images[].bytes` | `pdfs[].bytes` | `videos[].bytes` |
| --- | --- | --- | --- |
| `extract(zip)` defaults | `null` (`omitted` if the file exists) | `null` (`omitted` if the file exists) | `null` |
| `extract(zip, { includeBytes: { images: true, pdfs: true, videos: false } })` | filled (`Uint8Array`) | filled (`Uint8Array`) | `null` (unless `videos: true` and local file) |
| `toJSON(result, { omitBytes: true })` | omitted in JSON | omitted in JSON | omitted in JSON |

| `bytesStatus` | Meaning |
| --- | --- |
| `present` | Bytes were loaded |
| `omitted` | File is in the ZIP; bytes were not requested |
| `missing` | File is not in the ZIP |
| `remote` | Vimeo/YouTube — `bytes` is always `null`; use `url` |

Use `includeBytes` when you need binary payloads. Remote videos always have `bytes: null` and a `url`. `width` / `height` / `byteSize` on images do not depend on this table.

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
| `unsupported_quiz_type: …` | A question was not recognized as `choice` and was emitted as `type: "other"`. Message includes the authoring type when known and the `documentId`. Match with `warning.startsWith(WarningCode.UNSUPPORTED_QUIZ_TYPE)`. |
| `quiz_missing_answer_key: …` | A quiz had no identifiable answer key. Questions are still present; every `responses[].correct` is `false`. Match with `warning.startsWith(WarningCode.QUIZ_MISSING_ANSWER_KEY)`. |
| `suspicious_empty_extraction: …` | The package has **4 or more** screens and the mean useful character count per screen is **below 40**. Useful text is linearized `text` with `[IMAGE_n]` / `[PDF_n]` / `[VIDEO_n]` stripped. This is a warning, not an error: extraction continues so a pipeline can flag silent misses (empty HoApp-B `as-texto` stubs, future dialects). Short 7-screen video wrappers stay above the threshold. Match with `warning.startsWith(WarningCode.SUSPICIOUS_EMPTY_EXTRACTION)`. |

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
const result = await extract(zipPath, {
  includeBytes: { images: true, pdfs: true },
});

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
