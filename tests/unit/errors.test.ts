import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  ErrorCode,
  extract,
  InvalidInputError,
  InvalidPackageError,
  IoError,
  isScormExtractorError,
  PackageTooLargeError,
  UnsafeZipPathError,
  UnsupportedPackageFormatError,
} from "../../src/index.js";
import {
  formatDisplayName,
  unsupportedPackageFormatMessage,
} from "../../src/domain/format-names.js";
import { sanitizeZipPath } from "../../src/infrastructure/zip-package-reader.js";
import { MINI_HOAPP_DATA_JS } from "../fixtures/mini-hoapp.js";

describe("error codes", () => {
  it("INVALID_INPUT for bad options", async () => {
    await expect(
      extract(new Uint8Array([1, 2, 3]), {
        // @ts-expect-error intentional invalid option
        maxUncompressedBytes: "nope",
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.INVALID_INPUT,
      name: "InvalidInputError",
    });
  });

  it("INVALID_INPUT for non-file URL", async () => {
    await expect(extract(new URL("https://example.com/a.zip"))).rejects.toBeInstanceOf(
      InvalidInputError,
    );
  });

  it("IO_FAILURE for missing path", async () => {
    await expect(extract("/tmp/scorm-extractor-does-not-exist-xyz.zip")).rejects.toMatchObject({
      code: ErrorCode.IO_FAILURE,
      name: "IoError",
    });
    await expect(
      extract("/tmp/scorm-extractor-does-not-exist-xyz.zip"),
    ).rejects.toBeInstanceOf(IoError);
  });

  it("INVALID_PACKAGE for non-zip bytes", async () => {
    await expect(extract(new Uint8Array([0, 1, 2, 3, 4]))).rejects.toMatchObject({
      code: ErrorCode.INVALID_PACKAGE,
      name: "InvalidPackageError",
    });
    await expect(extract(new Uint8Array([0, 1, 2, 3, 4]))).rejects.toBeInstanceOf(
      InvalidPackageError,
    );
  });

  it("UNSAFE_ZIP_PATH for zip-slip names", () => {
    expect(() => sanitizeZipPath("../evil.js")).toThrow(UnsafeZipPathError);
    expect(() => sanitizeZipPath("../evil.js")).toThrow(
      expect.objectContaining({ code: ErrorCode.UNSAFE_ZIP_PATH }),
    );
  });

  it("PACKAGE_TOO_LARGE when limit is tiny", async () => {
    const zip = new JSZip();
    zip.file("js/data.js", MINI_HOAPP_DATA_JS);
    zip.file("_telas/tela_01.html", "<p></p>");
    const bytes = await zip.generateAsync({ type: "uint8array" });
    await expect(
      extract(bytes, { maxUncompressedBytes: 1 }),
    ).rejects.toMatchObject({
      code: ErrorCode.PACKAGE_TOO_LARGE,
      name: "PackageTooLargeError",
    });
    await expect(extract(bytes, { maxUncompressedBytes: 1 })).rejects.toBeInstanceOf(
      PackageTooLargeError,
    );
  });

  it("UNSUPPORTED_PACKAGE_FORMAT with storyline hint", async () => {
    const zip = new JSZip();
    zip.file("story_content/story.js", "window.globalProvideData('data', '{}');");
    zip.file("imsmanifest.xml", "<manifest/>");
    const bytes = await zip.generateAsync({ type: "uint8array" });
    try {
      await extract(bytes);
      expect.fail("should throw");
    } catch (error) {
      expect(isScormExtractorError(error)).toBe(true);
      expect(error).toBeInstanceOf(UnsupportedPackageFormatError);
      if (error instanceof UnsupportedPackageFormatError) {
        expect(error.code).toBe(ErrorCode.UNSUPPORTED_PACKAGE_FORMAT);
        expect(error.detectedFormat).toBe("storyline");
        expect(error.message).toBe(unsupportedPackageFormatMessage("storyline"));
        expect(error.message).toContain("AST OnePage");
        expect(error.message).not.toContain("ASTOnePage");
        expect(error.message).toContain("Add a Storyline parser");
        expect(error.message).not.toMatch(/storylineparser/i);
      }
    }
  });

  it("unsupported format messages keep display-name spacing", () => {
    expect(formatDisplayName("ast-onepage")).toBe("AST OnePage");
    expect(formatDisplayName("storyline")).toBe("Storyline");
    expect(formatDisplayName("hoapp")).toBe("HoApp");

    const storyline = unsupportedPackageFormatMessage("storyline");
    expect(storyline).toBe(
      "Package looks like Storyline, which is not supported yet. Currently HoApp and AST OnePage are supported. Add a Storyline parser or convert the package.",
    );
    expect(storyline).toContain("AST OnePage");
    expect(storyline).not.toContain("ASTOnePage");
    expect(storyline).toContain("Storyline parser");
    expect(storyline).not.toMatch(/storylineparser/i);

    const unknown = unsupportedPackageFormatMessage("unknown");
    expect(unknown).toBe(
      "No supported authoring format was recognized. Currently HoApp and AST OnePage are supported. Add a parser for this format.",
    );
    expect(unknown).toContain("AST OnePage");
    expect(unknown).not.toContain("ASTOnePage");
  });

  it("isScormExtractorError type guard", () => {
    expect(isScormExtractorError(new InvalidPackageError("x"))).toBe(true);
    expect(isScormExtractorError(new Error("x"))).toBe(false);
    expect(isScormExtractorError(null)).toBe(false);
  });
});
