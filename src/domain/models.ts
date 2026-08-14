import { z } from "zod";

export const DEFAULT_MAX_UNCOMPRESSED_BYTES = 512 * 1024 * 1024;

/** Output contract version. Increment when the ExtractionResult shape changes. */
export const EXTRACTION_SCHEMA_VERSION = 2;

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
  /** Pixel width from the file header (`null` if unread). @since 0.3.0 */
  width: z.number().int().nonnegative().nullable(),
  /** Pixel height from the file header (`null` if unread). @since 0.3.0 */
  height: z.number().int().nonnegative().nullable(),
  /** File size in the ZIP (`null` if missing). @since 0.3.0 */
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

/**
 * SCORM CMI interaction types (IEEE 1484.11.1 / SCORM 2004).
 * Only `"choice"` is structured by parsers today; unrecognized items use `"other"`.
 * @since 0.3.0
 */
export const QUIZ_INTERACTION_TYPES = [
  "choice",
  "true-false",
  "fill-in",
  "long-fill-in",
  "matching",
  "sequencing",
  "likert",
  "numeric",
  "other",
] as const;

/** @since 0.3.0 */
export const quizInteractionTypeSchema = z.enum(QUIZ_INTERACTION_TYPES);

/** @since 0.3.0 */
export const quizResponseSchema = z.object({
  text: z.string(),
  /**
   * Identified correct option. `false` also covers “no answer key found”
   * (see `quiz_missing_answer_key`); never `null`.
   */
  correct: z.boolean(),
});

/** @since 0.3.0 */
export const quizFeedbackSchema = z.object({
  correct: z.string().nullable(),
  incorrect: z.string().nullable(),
});

/** @since 0.3.0 */
export const quizQuestionSchema = z.object({
  type: quizInteractionTypeSchema,
  question: z.string(),
  context: z.string().nullable(),
  responses: z.array(quizResponseSchema),
  feedback: quizFeedbackSchema.nullable(),
});

/** Structured quiz payload on `kind: "quiz"` documents. @since 0.3.0 */
export const quizSchema = z.object({
  questions: z.array(quizQuestionSchema),
});

const documentBaseFields = {
  id: z.string(),
  position: z.number(),
  text: z.string(),
};

const screenDocumentFields = {
  ...documentBaseFields,
  kind: z.literal("screen"),
};

const quizDocumentFields = {
  ...documentBaseFields,
  kind: z.literal("quiz"),
  quiz: quizSchema,
};

export const screenDocumentSchema = z.object({
  ...screenDocumentFields,
  images: z.array(imageAssetSchema),
  pdfs: z.array(pdfAssetSchema),
  videos: z.array(videoAssetSchema),
});

export const quizDocumentSchema = z.object({
  ...quizDocumentFields,
  images: z.array(imageAssetSchema),
  pdfs: z.array(pdfAssetSchema),
  videos: z.array(videoAssetSchema),
});

export const documentSchema = z.discriminatedUnion("kind", [
  screenDocumentSchema,
  quizDocumentSchema,
]);

export const screenDocumentJSONSchema = z.object({
  ...screenDocumentFields,
  images: z.array(imageAssetJSONSchema),
  pdfs: z.array(pdfAssetJSONSchema),
  videos: z.array(videoAssetJSONSchema),
});

export const quizDocumentJSONSchema = z.object({
  ...quizDocumentFields,
  images: z.array(imageAssetJSONSchema),
  pdfs: z.array(pdfAssetJSONSchema),
  videos: z.array(videoAssetJSONSchema),
});

export const extractedDocumentJSONSchema = z.discriminatedUnion("kind", [
  screenDocumentJSONSchema,
  quizDocumentJSONSchema,
]);

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
/** @since 0.3.0 */
export type QuizInteractionType = z.infer<typeof quizInteractionTypeSchema>;
/** @since 0.3.0 */
export type QuizResponse = z.infer<typeof quizResponseSchema>;
/** @since 0.3.0 */
export type QuizFeedback = z.infer<typeof quizFeedbackSchema>;
/** @since 0.3.0 */
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;
/** @since 0.3.0 */
export type Quiz = z.infer<typeof quizSchema>;
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
