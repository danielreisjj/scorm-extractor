export type ImagePixelSize = {
  width: number;
  height: number;
};

/**
 * Read pixel size from PNG / JPEG / GIF / WebP headers only.
 * Returns null when the format is unsupported or the header is incomplete.
 */
export function readImagePixelSize(bytes: Uint8Array): ImagePixelSize | null {
  if (bytes.length < 10) return null;
  if (isPng(bytes)) return pngSize(bytes);
  if (isGif(bytes)) return gifSize(bytes);
  if (isJpeg(bytes)) return jpegSize(bytes);
  if (isWebp(bytes)) return webpSize(bytes);
  return null;
}

export function isRasterImage(
  path: string,
  mimeType: string,
): boolean {
  if (/^image\/(png|jpeg|gif|webp)$/i.test(mimeType)) return true;
  return /\.(?:png|jpe?g|gif|webp)$/i.test(path);
}

function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  );
}

function isGif(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  );
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

function isWebp(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 16 &&
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

function pngSize(bytes: Uint8Array): ImagePixelSize | null {
  if (bytes.length < 24) return null;
  if (
    bytes[12] !== 0x49 ||
    bytes[13] !== 0x48 ||
    bytes[14] !== 0x44 ||
    bytes[15] !== 0x52
  ) {
    return null;
  }
  const width = readU32BE(bytes, 16);
  const height = readU32BE(bytes, 20);
  return positiveSize(width, height);
}

function gifSize(bytes: Uint8Array): ImagePixelSize | null {
  if (bytes.length < 10) return null;
  return positiveSize(readU16LE(bytes, 6), readU16LE(bytes, 8));
}

function jpegSize(bytes: Uint8Array): ImagePixelSize | null {
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1] ?? 0;
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x00) {
      offset += 2;
      continue;
    }
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    const length = readU16BE(bytes, offset + 2);
    if (length < 2) return null;
    if (isJpegSof(marker)) {
      if (offset + 8 >= bytes.length) return null;
      const height = readU16BE(bytes, offset + 5);
      const width = readU16BE(bytes, offset + 7);
      return positiveSize(width, height);
    }
    offset += 2 + length;
  }
  return null;
}

function isJpegSof(marker: number): boolean {
  return (
    (marker >= 0xc0 && marker <= 0xc3) ||
    (marker >= 0xc5 && marker <= 0xc7) ||
    (marker >= 0xc9 && marker <= 0xcb) ||
    (marker >= 0xcd && marker <= 0xcf)
  );
}

function webpSize(bytes: Uint8Array): ImagePixelSize | null {
  if (bytes.length < 16) return null;
  const chunk = String.fromCharCode(
    bytes[12] ?? 0,
    bytes[13] ?? 0,
    bytes[14] ?? 0,
    bytes[15] ?? 0,
  );
  if (chunk === "VP8X") {
    if (bytes.length < 30) return null;
    const width = readU24LE(bytes, 24) + 1;
    const height = readU24LE(bytes, 27) + 1;
    return positiveSize(width, height);
  }
  if (chunk === "VP8 ") {
    if (bytes.length < 30) return null;
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) {
      return null;
    }
    const width = readU16LE(bytes, 26) & 0x3fff;
    const height = readU16LE(bytes, 28) & 0x3fff;
    return positiveSize(width, height);
  }
  if (chunk === "VP8L") {
    if (bytes.length < 25) return null;
    if (bytes[20] !== 0x2f) return null;
    const bits = readU32LE(bytes, 21);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >> 14) & 0x3fff) + 1;
    return positiveSize(width, height);
  }
  return null;
}

function positiveSize(width: number, height: number): ImagePixelSize | null {
  if (width < 1 || height < 1) return null;
  return { width, height };
}

function readU16BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}

function readU16LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

function readU24LE(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] ?? 0) |
    ((bytes[offset + 1] ?? 0) << 8) |
    ((bytes[offset + 2] ?? 0) << 16)
  );
}

function readU32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) * 0x1000000 +
      ((bytes[offset + 1] ?? 0) << 16) +
      ((bytes[offset + 2] ?? 0) << 8) +
      (bytes[offset + 3] ?? 0)) >>>
    0
  );
}

function readU32LE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) |
      ((bytes[offset + 1] ?? 0) << 8) |
      ((bytes[offset + 2] ?? 0) << 16) |
      ((bytes[offset + 3] ?? 0) << 24)) >>>
    0
  );
}
