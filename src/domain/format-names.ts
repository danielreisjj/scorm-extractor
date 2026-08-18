import type { DetectedUnsupportedFormat } from "./errors.js";
import { AST_ONEPAGE_FORMAT, HOAPP_FORMAT } from "./format-id.js";

/**
 * Human-readable format names for error messages. Identifiers (`ast-onepage`,
 * `storyline`) stay on `detectedFormat` / `result.format`.
 */
export const FORMAT_DISPLAY_NAME: Record<string, string> = {
  [HOAPP_FORMAT]: "HoApp",
  [AST_ONEPAGE_FORMAT]: "AST OnePage",
  storyline: "Storyline",
  rise: "Rise",
  captivate: "Captivate",
  unknown: "unknown/unrecognized",
};

const SUPPORTED_FORMAT_IDS = [HOAPP_FORMAT, AST_ONEPAGE_FORMAT] as const;

export function formatDisplayName(id: string): string {
  return FORMAT_DISPLAY_NAME[id] ?? id;
}

function supportedFormatsList(): string {
  return SUPPORTED_FORMAT_IDS.map(formatDisplayName).join(" and ");
}

/**
 * Single source for UnsupportedPackageFormatError messages. Always interpolate
 * display names with spaces — never glue an id onto the next English word
 * (`ASTOnePage`, `storylineparser`).
 */
export function unsupportedPackageFormatMessage(
  detected: DetectedUnsupportedFormat,
): string {
  const supported = supportedFormatsList();
  if (detected === "unknown") {
    return `No supported authoring format was recognized. Currently ${supported} are supported. Add a parser for this format.`;
  }
  const label = formatDisplayName(detected);
  return `Package looks like ${label}, which is not supported yet. Currently ${supported} are supported. Add a ${label} parser or convert the package.`;
}
