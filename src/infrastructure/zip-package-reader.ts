import JSZip from "jszip";
import {
  InvalidPackageError,
  PackageTooLargeError,
  UnsafeZipPathError,
} from "../domain/errors.js";
import { DEFAULT_MAX_UNCOMPRESSED_BYTES } from "../domain/models.js";
import type { PackageReader } from "../domain/ports.js";

export type ZipOpenOptions = {
  maxUncompressedBytes?: number;
};

export class ZipPackageReader implements PackageReader {
  private constructor(private readonly files: Map<string, Uint8Array>) {}

  static async fromBytes(
    bytes: Uint8Array,
    options: ZipOpenOptions = {},
  ): Promise<ZipPackageReader> {
    const maxUncompressedBytes =
      options.maxUncompressedBytes ?? DEFAULT_MAX_UNCOMPRESSED_BYTES;

    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(bytes);
    } catch (error) {
      throw new InvalidPackageError(
        "Package is not a valid ZIP archive. Pass a SCORM .zip file or its bytes.",
        { cause: error },
      );
    }

    const files = new Map<string, Uint8Array>();
    let totalUncompressed = 0;

    for (const [rawName, entry] of Object.entries(zip.files)) {
      if (!entry || entry.dir) continue;
      const name = sanitizeZipPath(rawName);
      const content = await entry.async("uint8array");
      totalUncompressed += content.byteLength;
      if (totalUncompressed > maxUncompressedBytes) {
        throw new PackageTooLargeError(
          `Package uncompressed size exceeds limit of ${maxUncompressedBytes} bytes. Pass a higher maxUncompressedBytes if this package is trusted.`,
        );
      }
      files.set(name, content);
    }

    if (files.size === 0) {
      throw new InvalidPackageError("ZIP archive contains no files");
    }

    return new ZipPackageReader(files);
  }

  list(): string[] {
    return [...this.files.keys()];
  }

  has(path: string): boolean {
    return this.files.has(normalizePath(path));
  }

  async readText(path: string): Promise<string> {
    const bytes = this.require(path);
    return new TextDecoder("utf-8").decode(bytes);
  }

  async readBytes(path: string): Promise<Uint8Array> {
    return this.require(path);
  }

  private require(path: string): Uint8Array {
    const entry = this.files.get(normalizePath(path));
    if (!entry) {
      throw new InvalidPackageError(`Missing file in package: ${path}`);
    }
    return entry;
  }
}

export function sanitizeZipPath(rawName: string): string {
  const normalized = rawName.replace(/\\/g, "/");
  if (normalized.startsWith("/") || normalized.includes("..")) {
    throw new UnsafeZipPathError(
      `Unsafe path in ZIP rejected (zip-slip): ${rawName}`,
    );
  }
  return normalizePath(normalized);
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "");
}
