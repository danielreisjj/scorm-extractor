# scorm-extractor

npm library. Agents: follow this file. Humans: see `README.md` and `docs/`.

## Product

| | |
| --- | --- |
| API | `extract(source, options?)` → `ExtractionResult`; `toJSON(result)` |
| Errors | `ScormExtractorError` + stable `ErrorCode` |

Supported format today: **HoApp** and **AST OnePage**. New formats = new parser + registry entry. Do **not** change `extract()` or the output shape.

## Commands

```bash
npm install
npm test
npm run lint
npm run build
npm run extract:all   # needs ZIPs in scorms/ (gitignored)
```

Vitest only. No network. Integration tests against `scorms/*.zip` may `skip` when a file is missing.

## Layout

```
src/domain/          # models, errors, ports — no infrastructure imports
src/application/     # extract orchestration
src/infrastructure/  # ZIP, parsers, assets
src/index.ts         # public exports
tests/               # unit + integration
examples/            # consumer snippets
docs/                # human guide + architecture
```

## Rules

- Pure importable library: the exported API (`extract`, `toJSON`, errors, types) is the only public surface — no server, CLI, container, or language port.
- Small files, English identifiers. Clean architecture: `domain/` must not import `infrastructure/`.
- No `utils.ts` god-object. No `interfaces/` folder.
- Protect ZIP reads (zip-slip, zip bombs).
- Parse package JS as data (regex / balanced literals / `JSON.parse`). Never `eval` or `new Function`.
- Marker/`ref` invariant: every `[IMAGE_n]`, `[PDF_n]`, `[VIDEO_n]` in `text` has a matching `ref` in that screen’s arrays, and vice versa.
- Keep UI / pedagogical copy in `text`. Omit player chrome **files** only (`midias/interface/`, `resources/interface/`, `bg/`, fonts, logos) — do not strip phrases from text.
- Assets: `bytes: Uint8Array | null`. JSON transport via `toJSON` only.
- `kind`: `"screen" | "quiz"`. Quiz documents include structured `quiz`; screens must not. No `documents[].title`. No `images[].role`.
- Errors must be `ScormExtractorError` subclasses with stable `ErrorCode`.
- Never log base64 or dump `scorms/` (client material); never commit `.cursor/`, `private/`, or client ZIPs.

## Scope

Converts SCORM packages into linearized screen text and asset references, and stops there. Transcription, OCR, embedding, indexing, and orchestration are the consumer's responsibility and out of scope for this repo. Media bytes stay opt-in (`includeBytes`); course playback stays with the LMS.
