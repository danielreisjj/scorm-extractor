import {
  UnsupportedPackageFormatError,
  type DetectedUnsupportedFormat,
} from "../domain/errors.js";
import { HOAPP_FORMAT, type FormatId } from "../domain/format-id.js";
import type { FormatDetector, PackageReader } from "../domain/ports.js";

const DATA_JS = "js/data.js";

export class HoappFormatDetector implements FormatDetector {
  async detect(reader: PackageReader): Promise<FormatId> {
    if (await looksLikeHoapp(reader)) {
      return HOAPP_FORMAT;
    }

    const detected = detectUnsupportedFormat(reader);
    const hint =
      detected === "unknown"
        ? "No supported authoring format was recognized. Currently only HoApp (js/data.js + as-course) is supported. Add a parser for this format."
        : `Package looks like ${detected}, which is not supported yet. Currently only HoApp is supported. Add a ${detected} parser or convert the package.`;

    throw new UnsupportedPackageFormatError(hint, { detectedFormat: detected });
  }
}

async function looksLikeHoapp(reader: PackageReader): Promise<boolean> {
  const names = reader.list();
  const hasTelas = names.some((name) => name.startsWith("_telas/"));
  if (!reader.has(DATA_JS)) {
    return hasTelas && names.some((name) => name.includes("as-course") || name === "index.html");
  }
  const dataJs = await reader.readText(DATA_JS);
  const hasHoappFingerprint =
    dataJs.includes("HoApp") ||
    dataJs.includes("as-course") ||
    dataJs.includes("new SectionEditable") ||
    dataJs.includes("type: 'as-") ||
    dataJs.includes('type: "as-');
  return hasHoappFingerprint || hasTelas;
}

export function detectUnsupportedFormat(
  reader: PackageReader,
): DetectedUnsupportedFormat {
  const names = reader.list().map((name) => name.toLowerCase());
  const joined = names.join("\n");

  if (
    names.some((name) => name.startsWith("story_content/")) ||
    names.some((name) => name.includes("html5/data/js/")) ||
    joined.includes("globalprovidedata")
  ) {
    return "storyline";
  }

  if (
    names.some((name) => name.startsWith("scormcontent/")) ||
    names.some((name) => name.includes("rise"))
  ) {
    return "rise";
  }

  if (
    names.some((name) => name.includes("captivate")) ||
    names.some((name) => name.endsWith("project.txt"))
  ) {
    return "captivate";
  }

  return "unknown";
}
