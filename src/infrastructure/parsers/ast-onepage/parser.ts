import { InvalidPackageError } from "../../../domain/errors.js";
import { AST_ONEPAGE_FORMAT } from "../../../domain/format-id.js";
import {
  EXTRACTION_SCHEMA_VERSION,
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
import {
  linearizeHtml,
  type LinearizedScreen,
} from "../html/html-linearizer.js";
import {
  readContentHtml,
  readCourseMeta,
  readRootHtml,
  splitScreens,
} from "./content.js";
import { loadQuizzes, quizToHtml } from "./quiz.js";

export class AstOnepageParser implements PackageParser {
  readonly format = AST_ONEPAGE_FORMAT;

  async parse(
    reader: PackageReader,
    options: ResolvedExtractOptions,
  ): Promise<ExtractionResult> {
    const { path, html } = await readContentHtml(reader);
    const screens = splitScreens(html);
    if (screens.length === 0) {
      throw new InvalidPackageError(
        "AST OnePage package has no screens (div#cN / .container)",
      );
    }

    const rootHtml = await readRootHtml(reader);
    const course = await readCourseMeta(reader, html, rootHtml);
    const basePath = dirname(path);
    const loader = new AssetLoader(reader);
    const warnings: string[] = [];

    const documents: ExtractedDocument[] = [];
    for (const screen of screens) {
      documents.push(
        await documentFromHtml(
          screen.id,
          screen.position,
          "screen",
          screen.html,
          basePath,
          loader,
          options,
          warnings,
        ),
      );
    }

    const { quizzes, warnings: quizWarnings } = await loadQuizzes(reader);
    warnings.push(...quizWarnings);
    let position = documents.length;
    for (const quiz of quizzes) {
      position += 1;
      documents.push(
        await documentFromHtml(
          quiz.id,
          position,
          "quiz",
          quizToHtml(quiz),
          basePath,
          loader,
          options,
          warnings,
        ),
      );
    }

    return {
      schemaVersion: EXTRACTION_SCHEMA_VERSION,
      format: AST_ONEPAGE_FORMAT,
      warnings,
      course,
      documents,
    };
  }
}

async function documentFromHtml(
  id: string,
  position: number,
  kind: ExtractedDocument["kind"],
  html: string,
  basePath: string,
  loader: AssetLoader,
  options: ResolvedExtractOptions,
  warnings: string[],
): Promise<ExtractedDocument> {
  const linearized = linearizeHtml(html, {
    videosById: new Map(),
    basePath,
  });
  return {
    id,
    position,
    kind,
    text: linearized.text,
    images: await loadImages(linearized, loader, options, warnings, id),
    pdfs: await loadPdfs(linearized, loader, options, warnings, id),
    videos: await loadVideos(linearized, loader, options, warnings, id),
  };
}

async function loadImages(
  linearized: LinearizedScreen,
  loader: AssetLoader,
  options: ResolvedExtractOptions,
  warnings: string[],
  screenId: string,
): Promise<ImageAsset[]> {
  const images: ImageAsset[] = [];
  for (const image of linearized.images) {
    const loaded = await loader.loadAsset(
      image.originalPath,
      options.includeBytes.images,
    );
    if (loaded.missing) {
      warnings.push(`Missing image '${image.originalPath}' in ${screenId}`);
    }
    const dimWarning = imageDimensionWarning(loaded, image.originalPath, screenId);
    if (dimWarning) warnings.push(dimWarning);
    images.push(hydrateImageAsset(image, loaded));
  }
  return images;
}

async function loadPdfs(
  linearized: LinearizedScreen,
  loader: AssetLoader,
  options: ResolvedExtractOptions,
  warnings: string[],
  screenId: string,
): Promise<PdfAsset[]> {
  const pdfs: PdfAsset[] = [];
  for (const pdf of linearized.pdfs) {
    const loaded = await loader.loadAsset(
      pdf.originalPath,
      options.includeBytes.pdfs,
    );
    if (loaded.missing) {
      warnings.push(`Missing PDF '${pdf.originalPath}' in ${screenId}`);
    }
    pdfs.push({
      ...pdf,
      mimeType: "application/pdf",
      bytes: loaded.bytes,
      bytesStatus: bytesStatusFromLoaded(loaded),
    });
  }
  return pdfs;
}

async function loadVideos(
  linearized: LinearizedScreen,
  loader: AssetLoader,
  options: ResolvedExtractOptions,
  warnings: string[],
  screenId: string,
): Promise<VideoAsset[]> {
  const videos: VideoAsset[] = [];
  for (const video of linearized.videos) {
    if (video.source === "local" && video.originalPath) {
      const loaded = await loader.loadAsset(
        video.originalPath,
        options.includeBytes.videos,
      );
      if (loaded.missing) {
        warnings.push(`Missing video '${video.originalPath}' in ${screenId}`);
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
  return videos;
}

function dirname(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const index = normalized.lastIndexOf("/");
  return index < 0 ? "" : normalized.slice(0, index);
}
