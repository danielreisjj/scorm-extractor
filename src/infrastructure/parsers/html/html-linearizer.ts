import * as cheerio from "cheerio";
import type { Element, AnyNode } from "domhandler";
import type { ImageAsset, PdfAsset, VideoAsset } from "../../../domain/models.js";
import { classifyAsset, mimeFromPath } from "../../asset-classifier.js";
import {
  isExternalUrl,
  normalizeAssetPath,
  resolvePackagePath,
} from "../../asset-loader.js";
import { filenameFromPath } from "../../../serialize.js";
import { normalizeExtractedText } from "./text-normalizer.js";

export interface LinearizeContext {
  videosById: Map<string, VideoComponentData>;
  /** Directory of the HTML file inside the ZIP, used to resolve relative asset paths. */
  basePath?: string;
}

export interface VideoComponentData {
  videoType: string;
  path: string;
  title: string;
}

export interface LinearizedScreen {
  text: string;
  images: ImageAsset[];
  pdfs: PdfAsset[];
  videos: VideoAsset[];
}

const BLOCK_TAGS = new Set([
  "p",
  "div",
  "section",
  "article",
  "header",
  "footer",
  "li",
  "ul",
  "ol",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "tr",
  "blockquote",
  "figcaption",
  "figure",
  "dt",
  "dd",
]);

/** Skip runtime chrome only — never skip button (PDF downloads live there). */
const SKIP_TAGS = new Set(["script", "style", "noscript", "svg"]);

export function linearizeHtml(
  html: string,
  context: LinearizeContext,
): LinearizedScreen {
  const $ = cheerio.load(html);
  const images: ImageAsset[] = [];
  const pdfs: PdfAsset[] = [];
  const videos: VideoAsset[] = [];
  const chunks: string[] = [];

  const seenImages = new Set<string>();
  const seenPdfs = new Set<string>();
  const seenVideos = new Set<string>();

  function pushText(value: string): void {
    if (value) chunks.push(value);
  }

  function pushBlock(): void {
    chunks.push("\n\n");
  }

  function resolvePath(raw: string): string {
    const normalized = normalizeAssetPath(raw);
    if (!normalized) return "";
    if (context.basePath) {
      if (isExternalUrl(normalized)) return "";
      return resolvePackagePath(context.basePath, normalized);
    }
    return normalized;
  }

  function emitImage(src: string, alt: string, className: string): void {
    const path = resolvePath(src);
    if (!path || seenImages.has(path)) return;
    if (classifyAsset(path, { className }) !== "content") return;
    seenImages.add(path);
    const index = images.length;
    const ref = `IMAGE_${index}`;
    images.push({
      ref,
      mimeType: mimeFromPath(path),
      originalPath: path,
      filename: filenameFromPath(path),
      alt,
      width: null,
      height: null,
      byteSize: null,
      bytes: null,
      bytesStatus: "omitted",
      url: null,
    });
    pushBlock();
    pushText(`[${ref}]`);
    pushBlock();
  }

  function emitPdf(pathRaw: string): void {
    if (isExternalUrl(pathRaw)) return;
    const path = resolvePath(pathRaw);
    if (!path.toLowerCase().endsWith(".pdf") || seenPdfs.has(path)) return;
    seenPdfs.add(path);
    const index = pdfs.length;
    const ref = `PDF_${index}`;
    pdfs.push({
      ref,
      mimeType: "application/pdf",
      originalPath: path,
      filename: filenameFromPath(path),
      bytes: null,
      bytesStatus: "omitted",
      url: null,
    });
    pushBlock();
    pushText(`[${ref}]`);
    pushBlock();
  }

  function emitVideo(data: VideoComponentData): void {
    const index = videos.length;
    const ref = `VIDEO_${index}`;
    videos.push(toVideoAsset(ref, data));
    pushBlock();
    pushText(`[${ref}]`);
    pushBlock();
  }

  function emitLocalVideo(pathRaw: string, title: string): void {
    const path = resolvePath(pathRaw);
    if (!path || seenVideos.has(path)) return;
    seenVideos.add(path);
    emitVideo({ videoType: "FILE", path, title });
  }

  function walk(node: AnyNode): void {
    if (node.type === "text") {
      pushText(decodeText(node.data ?? ""));
      return;
    }
    if (!isElement(node)) return;
    const tag = node.tagName.toLowerCase();
    if (SKIP_TAGS.has(tag)) return;

    if (tag === "br") {
      chunks.push("\n");
      return;
    }

    if (node.attribs["data-extract-video"]) {
      const id = node.attribs["data-extract-video"] ?? "";
      const data = context.videosById.get(id);
      if (data) emitVideo(data);
      return;
    }

    if (tag === "video") {
      emitLocalVideo(videoSrcFromElement(node), node.attribs.title ?? "");
      return;
    }

    if (tag === "img") {
      emitImage(
        node.attribs.src ?? "",
        node.attribs.alt ?? "",
        node.attribs.class ?? "",
      );
      return;
    }

    const pdfPath = pdfPathFromElement(node);
    if (pdfPath) {
      for (const child of node.childNodes) walk(child);
      emitPdf(pdfPath);
      return;
    }

    if (tag === "iframe") {
      const src = node.attribs.src ?? "";
      const video = videoFromUrl(src);
      if (video) emitVideo(video);
      return;
    }

    const block = BLOCK_TAGS.has(tag);
    if (block) pushBlock();
    for (const child of node.childNodes) walk(child);
    if (block) pushBlock();
  }

  const roots = $("body").length
    ? $("body").contents().toArray()
    : $.root().contents().toArray();
  for (const node of roots) walk(node);

  return {
    text: normalizeExtractedText(chunks.join("")),
    images,
    pdfs,
    videos,
  };
}

export function toVideoAsset(ref: string, data: VideoComponentData): VideoAsset {
  const source = classifyVideoSource(data.videoType, data.path);
  const isRemote = source === "vimeo" || source === "youtube";
  const localPath = isRemote ? null : data.path || null;
  return {
    ref,
    source,
    mimeType: isRemote ? null : localPath ? mimeFromPath(localPath) : null,
    originalPath: localPath,
    filename: localPath ? filenameFromPath(localPath) : null,
    url: isRemote ? data.path : null,
    title: data.title || "",
    bytes: null,
    bytesStatus: isRemote ? "remote" : "omitted",
  };
}

export function classifyVideoSource(
  videoType: string,
  path: string,
): VideoAsset["source"] {
  const type = videoType.toUpperCase();
  if (type.includes("VIMEO") || /vimeo\.com/i.test(path)) return "vimeo";
  if (type.includes("YOUTUBE") || /youtu(\.be|be\.com)/i.test(path)) {
    return "youtube";
  }
  return "local";
}

function videoSrcFromElement(el: Element): string {
  const direct = el.attribs.src ?? "";
  if (direct.trim()) return direct;
  for (const child of el.childNodes) {
    if (!isElement(child) || child.tagName.toLowerCase() !== "source") continue;
    const src = child.attribs.src ?? "";
    if (src.trim()) return src;
  }
  return "";
}

function videoFromUrl(src: string): VideoComponentData | null {
  if (!src) return null;
  if (/vimeo\.com/i.test(src)) {
    return { videoType: "VIMEO", path: src, title: "" };
  }
  if (/youtu(\.be|be\.com)/i.test(src)) {
    return { videoType: "YOUTUBE", path: src, title: "" };
  }
  return null;
}

function pdfPathFromElement(el: Element): string | null {
  const href = el.attribs.href ?? "";
  const onclick = el.attribs.onclick ?? "";
  const dataHref = el.attribs["data-href"] ?? "";
  const haystack = `${href} ${onclick} ${dataHref}`;
  const match = haystack.match(/([^"'\\\s)]+\.pdf)/i);
  return match?.[1] ?? null;
}

function isElement(node: AnyNode): node is Element {
  return node.type === "tag";
}

function decodeText(value: string): string {
  return value.replace(/\s+/g, " ");
}
