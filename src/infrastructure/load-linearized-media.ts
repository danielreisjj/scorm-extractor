import type {
  ImageAsset,
  PdfAsset,
  ResolvedExtractOptions,
  VideoAsset,
} from "../domain/models.js";
import {
  type AssetLoader,
  bytesStatusFromLoaded,
  hydrateImageAsset,
  imageDimensionWarning,
} from "./asset-loader.js";

export type LinearizedMedia = {
  images: ImageAsset[];
  pdfs: PdfAsset[];
  videos: VideoAsset[];
};

/**
 * Load bytes and fill `bytesStatus` / image headers for already-detected
 * screen media. Parsers still locate assets in their own format; this is
 * only the shared ZIP hydration step.
 */
export async function loadLinearizedMedia(
  detected: LinearizedMedia,
  loader: AssetLoader,
  includeBytes: ResolvedExtractOptions["includeBytes"],
  warnings: string[],
  screenId: string,
): Promise<LinearizedMedia> {
  const images: ImageAsset[] = [];
  for (const image of detected.images) {
    const loaded = await loader.loadAsset(
      image.originalPath,
      includeBytes.images,
    );
    if (loaded.missing) {
      warnings.push(`Missing image '${image.originalPath}' in ${screenId}`);
    }
    const dimWarning = imageDimensionWarning(
      loaded,
      image.originalPath,
      screenId,
    );
    if (dimWarning) warnings.push(dimWarning);
    images.push(hydrateImageAsset(image, loaded));
  }

  const pdfs: PdfAsset[] = [];
  for (const pdf of detected.pdfs) {
    const loaded = await loader.loadAsset(pdf.originalPath, includeBytes.pdfs);
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

  const videos: VideoAsset[] = [];
  for (const video of detected.videos) {
    if (video.source === "local" && video.originalPath) {
      const loaded = await loader.loadAsset(
        video.originalPath,
        includeBytes.videos,
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

  return { images, pdfs, videos };
}
