import type { PackageReader } from "../domain/ports.js";
import type { BytesStatus, ImageAsset } from "../domain/models.js";
import { mimeFromPath } from "./asset-classifier.js";
import { isRasterImage, readImagePixelSize } from "./image-headers.js";

const PNG = [0x89, 0x50, 0x4e, 0x47];
const JPEG = [0xff, 0xd8, 0xff];
const GIF = [0x47, 0x49, 0x46];
const PDF = [0x25, 0x50, 0x44, 0x46];

export type LoadedAsset = {
  bytes: Uint8Array | null;
  mimeType: string;
  missing: boolean;
  byteSize: number | null;
  width: number | null;
  height: number | null;
};

export function bytesStatusFromLoaded(
  loaded: LoadedAsset,
): Exclude<BytesStatus, "remote"> {
  if (loaded.missing) return "missing";
  if (loaded.bytes) return "present";
  return "omitted";
}

export class AssetLoader {
  constructor(private readonly reader: PackageReader) {}

  async loadAsset(path: string, includeBytes: boolean): Promise<LoadedAsset> {
    const normalized = normalizeAssetPath(path);
    if (!this.reader.has(normalized)) {
      return {
        bytes: null,
        mimeType: mimeFromPath(path),
        missing: true,
        byteSize: null,
        width: null,
        height: null,
      };
    }
    const bytes = await this.reader.readBytes(normalized);
    const size = readImagePixelSize(bytes);
    return {
      bytes: includeBytes ? bytes : null,
      mimeType: this.mimeFor(path, bytes),
      missing: false,
      byteSize: bytes.byteLength,
      width: size?.width ?? null,
      height: size?.height ?? null,
    };
  }

  mimeFor(path: string, bytes?: Uint8Array): string {
    if (bytes && bytes.length >= 4) {
      if (startsWith(bytes, PNG)) return "image/png";
      if (startsWith(bytes, JPEG)) return "image/jpeg";
      if (startsWith(bytes, GIF)) return "image/gif";
      if (isWebpMagic(bytes)) return "image/webp";
      if (startsWith(bytes, PDF)) return "application/pdf";
    }
    return mimeFromPath(path);
  }
}

export function normalizeAssetPath(path: string): string {
  return (
    path
      .trim()
      .replace(/\\/g, "/")
      .replace(/^\.\//, "")
      .split("#")[0]
      ?.split("?")[0]
      ?.trim() ?? path.trim()
  );
}

export function isExternalUrl(path: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:)/i.test(path) || path.startsWith("//");
}

/** Resolve a package-relative path against a directory inside the ZIP. */
export function resolvePackagePath(baseDir: string, rawPath: string): string {
  const path = normalizeAssetPath(rawPath);
  if (!path || isExternalUrl(path)) return path;
  const base = baseDir.replace(/\\/g, "/").replace(/\/+$/, "");
  if (path.startsWith("/")) {
    return path.replace(/^\/+/, "");
  }
  const parts = [
    ...base.split("/").filter(Boolean),
    ...path.split("/"),
  ];
  const out: string[] = [];
  for (const part of parts) {
    if (part === "." || part === "") continue;
    if (part === "..") {
      out.pop();
      continue;
    }
    out.push(part);
  }
  return out.join("/");
}

function startsWith(bytes: Uint8Array, prefix: number[]): boolean {
  return prefix.every((value, index) => bytes[index] === value);
}

function isWebpMagic(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}

export function hydrateImageAsset(
  image: ImageAsset,
  loaded: LoadedAsset,
): ImageAsset {
  return {
    ...image,
    mimeType: loaded.mimeType,
    bytes: loaded.bytes,
    bytesStatus: bytesStatusFromLoaded(loaded),
    width: loaded.width,
    height: loaded.height,
    byteSize: loaded.byteSize,
  };
}

export function imageDimensionWarning(
  loaded: LoadedAsset,
  path: string,
  screenId: string,
): string | null {
  if (loaded.missing) return null;
  if (!isRasterImage(path, loaded.mimeType)) return null;
  if (loaded.width !== null && loaded.height !== null) return null;
  return `Could not read image dimensions for '${path}' in ${screenId}`;
}
