import type { PackageReader } from "../domain/ports.js";
import type { BytesStatus } from "../domain/models.js";
import { mimeFromPath } from "./asset-classifier.js";

const PNG = [0x89, 0x50, 0x4e, 0x47];
const JPEG = [0xff, 0xd8, 0xff];
const GIF = [0x47, 0x49, 0x46];
const PDF = [0x25, 0x50, 0x44, 0x46];

export type LoadedAsset = {
  bytes: Uint8Array | null;
  mimeType: string;
  missing: boolean;
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
      };
    }
    const bytes = await this.reader.readBytes(normalized);
    return {
      bytes: includeBytes ? bytes : null,
      mimeType: this.mimeFor(path, bytes),
      missing: false,
    };
  }

  mimeFor(path: string, bytes?: Uint8Array): string {
    if (bytes && bytes.length >= 4) {
      if (startsWith(bytes, PNG)) return "image/png";
      if (startsWith(bytes, JPEG)) return "image/jpeg";
      if (startsWith(bytes, GIF)) return "image/gif";
      if (startsWith(bytes, PDF)) return "application/pdf";
    }
    return mimeFromPath(path);
  }
}

export function normalizeAssetPath(path: string): string {
  return (
    path.replace(/\\/g, "/").replace(/^\.\//, "").split("#")[0]?.split("?")[0] ??
    path
  );
}

function startsWith(bytes: Uint8Array, prefix: number[]): boolean {
  return prefix.every((value, index) => bytes[index] === value);
}
