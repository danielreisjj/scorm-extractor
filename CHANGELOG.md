# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.0] - 2026-08-18

### Added

- Stable warning prefix `suspicious_empty_extraction` (`WarningCode.SUSPICIOUS_EMPTY_EXTRACTION`) when a package has 4 or more screens and mean useful text (markers stripped) is below 40 characters per screen. Extraction continues; pipelines can detect silent empty extracts.

### Fixed

- HoApp dialect B: expand empty `<as-texto>` (and `as-titulo` / `as-subtitulo` / `as-paragrafo`) stubs from `components[].data.value` so screen `text` is no longer blank when copy lives in `components.push` rather than inline `content:`.

## [0.4.0] - 2026-08-14

### Changed

- **Breaking:** `includeBytes` now defaults to `false` for images, PDFs, and videos (images and PDFs were `true` through 0.3.0). `extract()` without options does not load binary payloads; assets have `originalPath` and `bytesStatus: "omitted"`. Consumers that need bytes must pass `includeBytes` explicitly.

## [0.3.0] - 2026-08-14

### Added

- Nested ZIP envelope detection: if `imsmanifest.xml` is not at the ZIP root, the first-level folder that contains it becomes the content root (detection, parsers, asset paths).
- AST OnePage parser (`ast-onepage`): screens from `div#cN` in `resources/mN/index.html`, local MP4 references, optional `quiz/*.json` as `kind: "quiz"`.
- `images[].width`, `images[].height`, and `images[].byteSize` (pixel size from file headers; file length in the ZIP). Filled even when `bytesStatus` is `"omitted"`. The library does not filter or crop.
- First-class `documents[].quiz` on `kind: "quiz"` screens (`questions[]` with SCORM interaction `type`, `question`, `context`, `responses`, `feedback`). Linearized `text` is unchanged. Only `choice` is structured by parsers; other types emit `type: "other"`.
- Stable warning prefixes `unsupported_quiz_type` and `quiz_missing_answer_key` (`WarningCode`). Missing answer keys keep every `responses[].correct` as `false` and do not throw.

### Changed

- Output `schemaVersion` went from **1** to **2**. Additive only: `documents[].quiz` was added on `kind: "quiz"` screens; no existing fields were removed.

## [0.2.0] - 2026-08-14

### Breaking

- Replaced `images[].base64` / `pdfs[].base64` / `videos[].base64` with native `bytes: Uint8Array | null`.
- Added `toJSON(result)` for JSON transport (`bytes` → `{ encoding: "base64", data }`).
- Replaced option `embedImages` with `includeBytes: { images, pdfs, videos }`.
- Removed `documents[].title` (already present in linearized `text`).
- Removed `images[].role` (chrome assets are omitted; remaining images are content).
- `documents[].kind` is now `"screen" | "quiz"` (was always `"screen"`).

### Added

- Typed error hierarchy with stable `ErrorCode` values and `isScormExtractorError()`.
- `filename` on image/PDF assets; video `filename` when local.
- PDF detection from `<button onclick="window.open('….pdf')">`.
- HoApp `Assessment` / `Question` expansion; quiz screens get `kind: "quiz"`.
- Unsupported-format detection hints for Storyline / Rise / Captivate.
- `maxUncompressedBytes` zip-bomb guard (default 512MB).
- GitHub docs, examples, ESLint, CI workflow.

### Changed

- UI copy (“Clique para…”, “Download”, “Iniciar”) is preserved (agnostic extraction).
- Package version surface documented as proprietary (`UNLICENSED`).

## [0.1.0] - 2026-08-13

### Added

- First public API: `extract()` for HoApp SCORM packages.
- Linearized screen text with `[IMAGE_n]`, `[PDF_n]`, `[VIDEO_n]` markers.
- Content images optionally embedded as base64.
- Extensible parser registry (HoApp dialects A and B).
