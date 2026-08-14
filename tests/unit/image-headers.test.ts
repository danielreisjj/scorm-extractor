import { describe, expect, it } from "vitest";
import { readImagePixelSize } from "../../src/infrastructure/image-headers.js";
import { TINY_PNG } from "../fixtures/mini-hoapp.js";

/** Minimal SOF0 JPEG: 20×10. */
const TINY_JPEG = Uint8Array.from([
  0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x0a, 0x00, 0x14, 0x01,
  0x01, 0x11, 0x00, 0xff, 0xd9,
]);

/** GIF87a 4×3 header (logical screen descriptor only). */
const TINY_GIF = Uint8Array.from([
  0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0x04, 0x00, 0x03, 0x00, 0x00, 0x00,
  0x00, 0x3b,
]);

/** VP8X WebP 32×16. */
const TINY_WEBP = Uint8Array.from([
  0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  0x56, 0x50, 0x38, 0x58, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x1f, 0x00, 0x00, 0x0f, 0x00, 0x00,
]);

describe("readImagePixelSize", () => {
  it("reads PNG IHDR", () => {
    expect(readImagePixelSize(TINY_PNG)).toEqual({ width: 1, height: 1 });
  });

  it("reads JPEG SOF0", () => {
    expect(readImagePixelSize(TINY_JPEG)).toEqual({ width: 20, height: 10 });
  });

  it("reads GIF logical screen", () => {
    expect(readImagePixelSize(TINY_GIF)).toEqual({ width: 4, height: 3 });
  });

  it("reads WebP VP8X", () => {
    expect(readImagePixelSize(TINY_WEBP)).toEqual({ width: 32, height: 16 });
  });

  it("returns null for truncated or unknown bytes", () => {
    expect(readImagePixelSize(new Uint8Array([1, 2, 3]))).toBeNull();
    expect(readImagePixelSize(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
  });
});
