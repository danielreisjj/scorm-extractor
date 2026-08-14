import { ZodError } from "zod";
import type {
  EncodedBytes,
  ExtractionResult,
  ExtractionResultJSON,
  ImageAsset,
  ImageAssetJSON,
  PdfAsset,
  PdfAssetJSON,
  ToJsonOptions,
  VideoAsset,
  VideoAssetJSON,
} from "./domain/models.js";
import { extractionResultJSONSchema } from "./domain/models.js";
import { InvalidInputError } from "./domain/errors.js";

/**
 * Serialize an {@link ExtractionResult} for JSON transport.
 * Replaces `Uint8Array` bytes with `{ encoding: "base64", data }`.
 *
 * @since 0.2.0
 */
export function toJSON(
  result: ExtractionResult,
  options: ToJsonOptions = {},
): ExtractionResultJSON {
  if (!result || typeof result !== "object" || !Array.isArray(result.documents)) {
    throw new InvalidInputError(
      "toJSON expects an ExtractionResult from extract()",
    );
  }
  const omitBytes = options.omitBytes === true;
  return {
    schemaVersion: result.schemaVersion,
    format: result.format,
    warnings: result.warnings,
    course: result.course,
    documents: result.documents.map((doc) => ({
      id: doc.id,
      position: doc.position,
      kind: doc.kind,
      text: doc.text,
      images: doc.images.map((image) => encodeImage(image, omitBytes)),
      pdfs: doc.pdfs.map((pdf) => encodePdf(pdf, omitBytes)),
      videos: doc.videos.map((video) => encodeVideo(video, omitBytes)),
    })),
  };
}

/**
 * Inverse of {@link toJSON}: decode `{ encoding: "base64", data }` back to `Uint8Array`.
 *
 * @since 0.2.0
 */
export function fromJSON(json: ExtractionResultJSON): ExtractionResult {
  if (!json || typeof json !== "object" || !Array.isArray(json.documents)) {
    throw new InvalidInputError(
      "fromJSON expects an ExtractionResultJSON from toJSON()",
    );
  }
  rejectUnknownEncodings(json);
  let parsed: ExtractionResultJSON;
  try {
    parsed = extractionResultJSONSchema.parse(json);
  } catch (error) {
    throw wrapFromJsonError(error);
  }
  return {
    schemaVersion: parsed.schemaVersion,
    format: parsed.format,
    warnings: parsed.warnings,
    course: parsed.course,
    documents: parsed.documents.map((doc) => ({
      id: doc.id,
      position: doc.position,
      kind: doc.kind,
      text: doc.text,
      images: doc.images.map(decodeImage),
      pdfs: doc.pdfs.map(decodePdf),
      videos: doc.videos.map(decodeVideo),
    })),
  };
}

function encodeImage(image: ImageAsset, omitBytes: boolean): ImageAssetJSON {
  return {
    ref: image.ref,
    mimeType: image.mimeType,
    originalPath: image.originalPath,
    filename: image.filename,
    alt: image.alt,
    bytesStatus: image.bytesStatus,
    bytes: omitBytes ? null : encodeBytes(image.bytes),
  };
}

function encodePdf(pdf: PdfAsset, omitBytes: boolean): PdfAssetJSON {
  return {
    ref: pdf.ref,
    mimeType: pdf.mimeType,
    originalPath: pdf.originalPath,
    filename: pdf.filename,
    bytesStatus: pdf.bytesStatus,
    bytes: omitBytes ? null : encodeBytes(pdf.bytes),
  };
}

function encodeVideo(video: VideoAsset, omitBytes: boolean): VideoAssetJSON {
  return {
    ref: video.ref,
    source: video.source,
    mimeType: video.mimeType,
    originalPath: video.originalPath,
    filename: video.filename,
    url: video.url,
    title: video.title,
    bytesStatus: video.bytesStatus,
    bytes: omitBytes ? null : encodeBytes(video.bytes),
  };
}

function encodeBytes(bytes: Uint8Array | null): EncodedBytes | null {
  if (!bytes) return null;
  return { encoding: "base64", data: uint8ToBase64(bytes) };
}

function decodeImage(image: ImageAssetJSON): ImageAsset {
  return { ...image, bytes: decodeBytes(image.bytes) };
}

function decodePdf(pdf: PdfAssetJSON): PdfAsset {
  return { ...pdf, bytes: decodeBytes(pdf.bytes) };
}

function decodeVideo(video: VideoAssetJSON): VideoAsset {
  return { ...video, bytes: decodeBytes(video.bytes) };
}

function decodeBytes(encoded: EncodedBytes | null): Uint8Array | null {
  if (!encoded) return null;
  if (encoded.encoding !== "base64") {
    throw new InvalidInputError(
      `Unsupported bytes encoding "${String(encoded.encoding)}". Only "base64" is supported.`,
    );
  }
  try {
    return base64ToUint8(encoded.data);
  } catch (error) {
    throw new InvalidInputError("Invalid base64 payload in bytes.data", {
      cause: error,
    });
  }
}

function rejectUnknownEncodings(json: ExtractionResultJSON): void {
  for (const doc of json.documents) {
    const lists = [doc?.images, doc?.pdfs, doc?.videos];
    for (const list of lists) {
      if (!Array.isArray(list)) continue;
      for (const asset of list) {
        const bytes = asset?.bytes;
        if (!bytes || typeof bytes !== "object") continue;
        const encoding = (bytes as { encoding?: unknown }).encoding;
        if (encoding !== undefined && encoding !== "base64") {
          throw new InvalidInputError(
            `Unsupported bytes encoding "${String(encoding)}". Only "base64" is supported.`,
          );
        }
      }
    }
  }
}

function wrapFromJsonError(error: unknown): InvalidInputError {
  if (error instanceof InvalidInputError) return error;
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    const path = issue?.path?.join(".") || "json";
    return new InvalidInputError(
      `Invalid toJSON payload at "${path}": ${issue?.message ?? "validation failed"}`,
      { cause: error },
    );
  }
  return new InvalidInputError("fromJSON expects an ExtractionResultJSON from toJSON()", {
    cause: error,
  });
}

export function uint8ToBase64(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export function base64ToUint8(data: string): Uint8Array {
  const binary = atob(data);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export function filenameFromPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] ?? path;
}
