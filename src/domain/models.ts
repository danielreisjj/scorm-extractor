import { z } from "zod";

export const DEFAULT_MAX_UNCOMPRESSED_BYTES = 512 * 1024 * 1024;

/** Output contract version. Increment when the ExtractionResult shape breaks. */
export const EXTRACTION_SCHEMA_VERSION = 1;

export const includeBytesSchema = z
  .object({
    images: z.boolean().optional(),
    pdfs: z.boolean().optional(),
    videos: z.boolean().optional(),
  })
  .optional()
  .default({});

export const extractOptionsSchema = z.object({
  includeBytes: includeBytesSchema,
  maxUncompressedBytes: z
    .number()
    .positive()
    .optional()
    .default(DEFAULT_MAX_UNCOMPRESSED_BYTES),
});

export type ExtractOptions = z.input<typeof extractOptionsSchema>;

export type ResolvedExtractOptions = {
  includeBytes: {
    images: boolean;
    pdfs: boolean;
    videos: boolean;
  };
  maxUncompressedBytes: number;
};

export function resolveExtractOptions(
  options: ExtractOptions = {},
): ResolvedExtractOptions {
  const parsed = extractOptionsSchema.parse(options);
  return {
    maxUncompressedBytes: parsed.maxUncompressedBytes,
    includeBytes: {
      images: parsed.includeBytes.images ?? true,
      pdfs: parsed.includeBytes.pdfs ?? true,
      videos: parsed.includeBytes.videos ?? false,
    },
  };
}

export const courseSchema = z.object({
  title: z.string(),
  code: z.string(),
  language: z.string(),
});

export const documentKindSchema = z.enum(["screen", "quiz"]);

/** Accept any Uint8Array view (ArrayBuffer / SharedArrayBuffer backends). */
const uint8ArraySchema = z.custom<Uint8Array>(
  (value): value is Uint8Array => value instanceof Uint8Array,
);

export const encodedBytesSchema = z.object({
  encoding: z.literal("base64"),
  data: z.string(),
});

export const bytesStatusSchema = z.enum([
  "present",
  "omitted",
  "missing",
  "remote",
]);

const imageAssetFields = {
  ref: z.string(),
  mimeType: z.string(),
  originalPath: z.string(),
  filename: z.string(),
  alt: z.string(),
  width: z.number().int().nonnegative().nullable(),
  height: z.number().int().nonnegative().nullable(),
  byteSize: z.number().int().nonnegative().nullable(),
  bytesStatus: bytesStatusSchema,
};

export const imageAssetSchema = z.object({
  ...imageAssetFields,
  bytes: uint8ArraySchema.nullable(),
});

export const imageAssetJSONSchema = z.object({
  ...imageAssetFields,
  bytes: encodedBytesSchema.nullable(),
});

const pdfAssetFields = {
  ref: z.string(),
  mimeType: z.literal("application/pdf"),
  originalPath: z.string(),
  filename: z.string(),
  bytesStatus: bytesStatusSchema,
};

export const pdfAssetSchema = z.object({
  ...pdfAssetFields,
  bytes: uint8ArraySchema.nullable(),
});

export const pdfAssetJSONSchema = z.object({
  ...pdfAssetFields,
  bytes: encodedBytesSchema.nullable(),
});

export const videoSourceSchema = z.enum(["vimeo", "youtube", "local"]);

const videoAssetFields = {
  ref: z.string(),
  source: videoSourceSchema,
  mimeType: z.string().nullable(),
  originalPath: z.string().nullable(),
  filename: z.string().nullable(),
  url: z.string().nullable(),
  title: z.string(),
  bytesStatus: bytesStatusSchema,
};

export const videoAssetSchema = z.object({
  ...videoAssetFields,
  bytes: uint8ArraySchema.nullable(),
});

export const videoAssetJSONSchema = z.object({
  ...videoAssetFields,
  bytes: encodedBytesSchema.nullable(),
});

const documentFields = {
  id: z.string(),
  position: z.number(),
  kind: documentKindSchema,
  text: z.string(),
};

export const documentSchema = z.object({
  ...documentFields,
  images: z.array(imageAssetSchema),
  pdfs: z.array(pdfAssetSchema),
  videos: z.array(videoAssetSchema),
});

export const extractedDocumentJSONSchema = z.object({
  ...documentFields,
  images: z.array(imageAssetJSONSchema),
  pdfs: z.array(pdfAssetJSONSchema),
  videos: z.array(videoAssetJSONSchema),
});

const extractionResultFields = {
  schemaVersion: z.number().int().positive(),
  format: z.string(),
  warnings: z.array(z.string()),
  course: courseSchema,
};

export const extractionResultSchema = z.object({
  ...extractionResultFields,
  documents: z.array(documentSchema),
});

export const extractionResultJSONSchema = z.object({
  ...extractionResultFields,
  documents: z.array(extractedDocumentJSONSchema),
});

export type Course = z.infer<typeof courseSchema>;
export type DocumentKind = z.infer<typeof documentKindSchema>;
export type BytesStatus = z.infer<typeof bytesStatusSchema>;
export type ImageAsset = z.infer<typeof imageAssetSchema>;
export type PdfAsset = z.infer<typeof pdfAssetSchema>;
export type VideoAsset = z.infer<typeof videoAssetSchema>;
export type ExtractedDocument = z.infer<typeof documentSchema>;
export type ExtractionResult = z.infer<typeof extractionResultSchema>;
export type EncodedBytes = z.infer<typeof encodedBytesSchema>;
export type ImageAssetJSON = z.infer<typeof imageAssetJSONSchema>;
export type PdfAssetJSON = z.infer<typeof pdfAssetJSONSchema>;
export type VideoAssetJSON = z.infer<typeof videoAssetJSONSchema>;
export type ExtractedDocumentJSON = z.infer<typeof extractedDocumentJSONSchema>;
export type ExtractionResultJSON = z.infer<typeof extractionResultJSONSchema>;

export type ToJsonOptions = {
  /** When true, omit binary payloads (paths/refs only). Default false. */
  omitBytes?: boolean;
};
