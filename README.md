# scorm-extractor

Extract linearized screen text and media asset references from SCORM packages.

TypeScript library for Node.js 20+ (ESM). Call `extract()` from your application; OCR, transcription, indexing, and LMS playback stay with the consumer. This is not a player, CLI, or HTTP service.

| | |
| --- | --- |
| Version | `0.2.0` |
| Runtime | Node.js ≥ 20 (ESM) |
| Format | HoApp |
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

const json = toJSON(result); // bytes → { encoding: "base64", data }

for (const doc of result.documents) {
  // Markers in text align with arrays on the same screen
  console.log(doc.id, doc.kind, doc.text);
}
```

## Options

| Option | Default | Description |
| --- | --- | --- |
| `includeBytes.images` | `true` | Populate `images[].bytes` |
| `includeBytes.pdfs` | `true` | Populate `pdfs[].bytes` |
| `includeBytes.videos` | `false` | Populate local `videos[].bytes` |
| `maxUncompressedBytes` | `512 MiB` | Reject packages that exceed the uncompressed ZIP limit |

## Output

One entry in `documents[]` per screen, in package order. Media are represented as markers in `text` (`[IMAGE_n]`, `[PDF_n]`, `[VIDEO_n]`); matching assets live in that screen’s `images` / `pdfs` / `videos` arrays. Indices restart at `0` on every screen. Marker and `ref` stay in 1:1 correspondence.

Contract details, field notes, and consumer patterns: [docs/guide.md](docs/guide.md).

## Supported formats

| Format | Status |
| --- | --- |
| HoApp (`js/data.js` / `as-course`) | Supported |
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
