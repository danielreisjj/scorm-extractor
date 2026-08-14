import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  extract,
  InvalidPackageError,
  UnsupportedPackageFormatError,
  WarningCode,
} from "../../src/index.js";

describe("package public API", () => {
  it("exports extract()", () => {
    expect(typeof extract).toBe("function");
    expect(WarningCode.UNSUPPORTED_QUIZ_TYPE).toBe("unsupported_quiz_type");
    expect(WarningCode.QUIZ_MISSING_ANSWER_KEY).toBe("quiz_missing_answer_key");
  });

  it("rejects a corrupt zip", async () => {
    await expect(extract(Buffer.from("not-a-zip"))).rejects.toBeInstanceOf(
      InvalidPackageError,
    );
  });

  it("rejects an unknown format", async () => {
    const zip = new JSZip();
    zip.file("readme.txt", "hello");
    const bytes = await zip.generateAsync({ type: "uint8array" });
    await expect(extract(bytes)).rejects.toBeInstanceOf(UnsupportedPackageFormatError);
  });
});
