import { WarningCode, formatWarning } from "../domain/warning-codes.js";

/**
 * Fire {@link WarningCode.SUSPICIOUS_EMPTY_EXTRACTION} when there are at
 * least this many documents. Cover-only packages with 1–3 screens stay quiet.
 * @since 0.5.0
 */
export const EMPTY_EXTRACTION_MIN_DOCUMENTS = 4;

/**
 * Mean useful characters per document below this value is treated as empty.
 * Useful text strips `[IMAGE_n]` / `[PDF_n]` / `[VIDEO_n]` markers, then
 * collapses whitespace. Calibrated above chrome-only dumps (LGPD-before-fix
 * averaged ~2) and below the short 7-screen HoApp series (~127+).
 * @since 0.5.0
 */
export const EMPTY_EXTRACTION_MIN_AVG_CHARS = 40;

const MARKER = /\[(IMAGE|PDF|VIDEO)_\d+\]/g;

export function usefulTextLength(text: string): number {
  return text.replace(MARKER, " ").replace(/\s+/g, " ").trim().length;
}

/**
 * Warning when a package has several screens but almost no linearized copy.
 * Does not throw — pipelines should treat this as a silent-extract signal.
 */
export function suspiciousEmptyExtractionWarning(
  documents: ReadonlyArray<{ text: string }>,
): string | null {
  if (documents.length < EMPTY_EXTRACTION_MIN_DOCUMENTS) return null;
  const total = documents.reduce(
    (sum, doc) => sum + usefulTextLength(doc.text),
    0,
  );
  const avg = total / documents.length;
  if (avg >= EMPTY_EXTRACTION_MIN_AVG_CHARS) return null;
  const rounded = Math.round(avg);
  return formatWarning(
    WarningCode.SUSPICIOUS_EMPTY_EXTRACTION,
    `${documents.length} screens with average ${rounded} useful characters (threshold: ${EMPTY_EXTRACTION_MIN_DOCUMENTS} screens and ${EMPTY_EXTRACTION_MIN_AVG_CHARS} chars/screen); extraction may have missed screen text`,
  );
}
