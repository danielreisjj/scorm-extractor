import { InvalidPackageError } from "../../../domain/errors.js";
import { HOAPP_FORMAT } from "../../../domain/format-id.js";
import {
  EXTRACTION_SCHEMA_VERSION,
  type DocumentKind,
  type ExtractedDocument,
  type ExtractionResult,
  type ImageAsset,
  type PdfAsset,
  type ResolvedExtractOptions,
  type VideoAsset,
} from "../../../domain/models.js";
import type { PackageParser, PackageReader } from "../../../domain/ports.js";
import {
  AssetLoader,
  bytesStatusFromLoaded,
  hydrateImageAsset,
  imageDimensionWarning,
} from "../../asset-loader.js";
import { dedupeResponsiveHtml } from "../html/responsive-deduper.js";
import {
  linearizeHtml,
  type VideoComponentData,
} from "../html/html-linearizer.js";
import { normalizeComparableText } from "../html/text-normalizer.js";
import { detectHoappDialect } from "./dialect.js";
import { parseDialectA } from "./dialect-a-parser.js";
import { parseDialectB } from "./dialect-b-parser.js";
import { expandComponents } from "./component-expander.js";
import {
  asString,
  isQuizComponentType,
  type HoappComponent,
  type HoappIR,
  type HoappSection,
} from "./ir.js";
import * as cheerio from "cheerio";

const DATA_JS = "js/data.js";

export class HoappParser implements PackageParser {
  readonly format = HOAPP_FORMAT;

  async parse(
    reader: PackageReader,
    options: ResolvedExtractOptions,
  ): Promise<ExtractionResult> {
    if (!reader.has(DATA_JS)) {
      throw new InvalidPackageError("HoApp package is missing js/data.js");
    }
    const dataJs = await reader.readText(DATA_JS);
    const dialect = detectHoappDialect(dataJs);
    const ir = dialect === "a" ? parseDialectA(dataJs) : parseDialectB(dataJs);
    const loader = new AssetLoader(reader);
    const warnings: string[] = [];

    const documents: ExtractedDocument[] = [];
    for (const section of ir.sections) {
      documents.push(
        await screenFromSection(section, ir, loader, options, warnings),
      );
    }

    const corpus = [
      ...ir.sections.map((section) => section.content),
      ...[...ir.components.values()].map((component) =>
        asString(component.data.label),
      ),
    ].join(" ");
    if (looksLikeLeftoverTitle(ir.course.title, corpus)) {
      warnings.push("course.title looks like a leftover template");
    }

    return {
      schemaVersion: EXTRACTION_SCHEMA_VERSION,
      format: HOAPP_FORMAT,
      warnings,
      course: ir.course,
      documents,
    };
  }
}

async function screenFromSection(
  section: HoappSection,
  ir: HoappIR,
  loader: AssetLoader,
  options: ResolvedExtractOptions,
  warnings: string[],
): Promise<ExtractedDocument> {
  const sectionComponents = collectSectionComponents(section, ir.components);
  const kind: DocumentKind = sectionComponents.some((component) =>
    isQuizComponentType(component.type),
  )
    ? "quiz"
    : "screen";

  const expanded = expandComponents(section.content, ir.components);
  const deduped = dedupeResponsiveHtml(expanded);
  const videosById = collectVideos(ir.components);
  const linearized = linearizeHtml(deduped, { videosById });

  const images: ImageAsset[] = [];
  for (const image of linearized.images) {
    const loaded = await loader.loadAsset(
      image.originalPath,
      options.includeBytes.images,
    );
    if (loaded.missing) {
      warnings.push(`Missing image '${image.originalPath}' in ${section.id}`);
    }
    const dimWarning = imageDimensionWarning(
      loaded,
      image.originalPath,
      section.id,
    );
    if (dimWarning) warnings.push(dimWarning);
    images.push(hydrateImageAsset(image, loaded));
  }

  const pdfs: PdfAsset[] = [];
  for (const pdf of linearized.pdfs) {
    const loaded = await loader.loadAsset(
      pdf.originalPath,
      options.includeBytes.pdfs,
    );
    if (loaded.missing) {
      warnings.push(`Missing PDF '${pdf.originalPath}' in ${section.id}`);
    }
    pdfs.push({
      ...pdf,
      mimeType: "application/pdf",
      bytes: loaded.bytes,
      bytesStatus: bytesStatusFromLoaded(loaded),
    });
  }

  const videos: VideoAsset[] = [];
  for (const video of linearized.videos) {
    if (video.source === "local" && video.originalPath) {
      const loaded = await loader.loadAsset(
        video.originalPath,
        options.includeBytes.videos,
      );
      if (loaded.missing) {
        warnings.push(
          `Missing video '${video.originalPath}' in ${section.id}`,
        );
      }
      videos.push({
        ...video,
        mimeType: loaded.mimeType,
        bytes: loaded.bytes,
        bytesStatus: bytesStatusFromLoaded(loaded),
      });
    } else if (video.source === "vimeo" || video.source === "youtube") {
      videos.push({ ...video, bytes: null, bytesStatus: "remote" });
    } else {
      videos.push({ ...video, bytes: null, bytesStatus: "missing" });
    }
  }

  return {
    id: section.id,
    position: section.position,
    kind,
    text: linearized.text,
    images,
    pdfs,
    videos,
  };
}

function collectSectionComponents(
  section: HoappSection,
  components: Map<string, HoappComponent>,
): HoappComponent[] {
  const $ = cheerio.load(section.content);
  const found: HoappComponent[] = [];
  const seen = new Set<string>();

  $("[id]").each((_, el) => {
    const id = $(el).attr("id");
    if (!id || seen.has(id)) return;
    const component = components.get(id);
    if (!component) return;
    seen.add(id);
    found.push(component);
  });

  // Dialect A may list component refs only in the section object; also scan tags.
  for (const [tag] of Object.entries({
    "as-question": true,
    "as-assessment": true,
  })) {
    $(tag).each((_, el) => {
      const id = $(el).attr("id");
      if (!id || seen.has(id)) return;
      const component = components.get(id);
      if (!component) return;
      seen.add(id);
      found.push(component);
    });
  }

  return found;
}

function collectVideos(
  components: Map<string, HoappComponent>,
): Map<string, VideoComponentData> {
  const map = new Map<string, VideoComponentData>();
  for (const component of components.values()) {
    if (component.type !== "video") continue;
    map.set(component.id, {
      videoType: asString(component.data.videoType),
      path: asString(component.data.path),
      title: asString(component.data.title),
    });
  }
  return map;
}

function looksLikeLeftoverTitle(title: string, corpus: string): boolean {
  const words = significantWords(title);
  if (words.length === 0) return true;
  const hay = normalizeComparableText(corpus);
  const hits = words.filter((word) => hay.includes(word)).length;
  return hits / words.length < 0.25;
}

function significantWords(text: string): string[] {
  return normalizeComparableText(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 4);
}
