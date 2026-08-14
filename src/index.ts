import { extractPackage, type ExtractSource } from "./application/extract-package.js";
import type { ExtractOptions, ExtractionResult } from "./domain/models.js";
import { ZipPackageReader } from "./infrastructure/zip-package-reader.js";
import { HoappFormatDetector } from "./infrastructure/format-detector.js";
import { createParserRegistry } from "./infrastructure/parsers/registry.js";

/**
 * Extract linearized screen text and media references from a SCORM package.
 *
 * Currently supports HoApp (`js/data.js` / `as-course`) and AST OnePage
 * (`scripts/js/ast_onepage_actions.js` + `resources/mN/index.html`).
 * Other authoring tools throw {@link UnsupportedPackageFormatError} with a
 * `detectedFormat` hint.
 *
 * @param source - File path, `file:` URL, `Uint8Array`, or `Buffer`
 * @param options - Byte inclusion and ZIP size limits
 * @returns Typed {@link ExtractionResult} with per-screen markers and assets
 * @throws {InvalidInputError} Invalid options or source type
 * @throws {IoError} File not found or unreadable
 * @throws {InvalidPackageError} Corrupt / empty / unreadable package
 * @throws {PackageTooLargeError} Uncompressed ZIP exceeds limit
 * @throws {UnsafeZipPathError} Zip-slip path rejected
 * @throws {UnsupportedPackageFormatError} Format not supported yet
 * @since 0.1.0
 * @example
 * ```ts
 * const result = await extract("curso.zip");
 * const json = toJSON(result);
 * ```
 */
export async function extract(
  source: ExtractSource,
  options: ExtractOptions = {},
): Promise<ExtractionResult> {
  return extractPackage(source, options, {
    openPackage: (bytes, zipOptions) =>
      ZipPackageReader.fromBytes(bytes, zipOptions),
    detector: new HoappFormatDetector(),
    registry: createParserRegistry(),
  });
}

export { extract as default };
export type { ExtractSource };
export { toJSON, fromJSON } from "./serialize.js";

export {
  extractOptionsSchema,
  extractionResultSchema,
  extractionResultJSONSchema,
  encodedBytesSchema,
  courseSchema,
  documentSchema,
  documentKindSchema,
  bytesStatusSchema,
  imageAssetSchema,
  pdfAssetSchema,
  videoAssetSchema,
  resolveExtractOptions,
  DEFAULT_MAX_UNCOMPRESSED_BYTES,
  EXTRACTION_SCHEMA_VERSION,
  type ExtractOptions,
  type ResolvedExtractOptions,
  type ExtractionResult,
  type ExtractionResultJSON,
  type Course,
  type ExtractedDocument,
  type DocumentKind,
  type BytesStatus,
  type ImageAsset,
  type PdfAsset,
  type VideoAsset,
  type ToJsonOptions,
  type EncodedBytes,
} from "./domain/models.js";

export {
  ErrorCode,
  ScormExtractorError,
  InvalidInputError,
  IoError,
  InvalidPackageError,
  PackageTooLargeError,
  UnsafeZipPathError,
  UnsupportedPackageFormatError,
  isScormExtractorError,
  type ErrorCodeValue,
  type DetectedUnsupportedFormat,
} from "./domain/errors.js";
