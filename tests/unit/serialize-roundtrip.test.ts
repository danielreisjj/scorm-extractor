import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  extract,
  EXTRACTION_SCHEMA_VERSION,
  extractionResultJSONSchema,
  fromJSON,
  InvalidInputError,
  toJSON,
} from "../../src/index.js";
import {
  MINI_HOAPP_DATA_JS,
  TINY_PNG,
} from "../fixtures/mini-hoapp.js";

async function miniZip(): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("js/data.js", MINI_HOAPP_DATA_JS);
  zip.file("midias/imagens/foto.png", TINY_PNG);
  zip.file("midias/docs/a.pdf", "%PDF-1.4 mini");
  zip.file("_telas/tela_01.html", "<p></p>");
  return zip.generateAsync({ type: "uint8array" });
}

function expectSameBytes(
  actual: Uint8Array | null | undefined,
  expected: Uint8Array | null | undefined,
): void {
  if (expected == null) {
    expect(actual).toBeNull();
    return;
  }
  expect(actual).toBeInstanceOf(Uint8Array);
  expect(Array.from(actual ?? [])).toEqual(Array.from(expected));
}

describe("toJSON / fromJSON", () => {
  it("round-trips extract() through JSON.parse(JSON.stringify(toJSON(r)))", async () => {
    const result = await extract(await miniZip(), {
      includeBytes: { images: true, pdfs: true },
    });
    const restored = fromJSON(JSON.parse(JSON.stringify(toJSON(result))));

    expect(restored.format).toBe(result.format);
    expect(restored.schemaVersion).toBe(EXTRACTION_SCHEMA_VERSION);
    expect(result.schemaVersion).toBe(EXTRACTION_SCHEMA_VERSION);
    expect(restored.warnings).toEqual(result.warnings);
    expect(restored.course).toEqual(result.course);
    expect(restored.documents).toHaveLength(result.documents.length);

    const original = result.documents[0];
    const copy = restored.documents[0];
    expect(copy?.id).toBe(original?.id);
    expect(copy?.text).toBe(original?.text);
    expectSameBytes(copy?.images[0]?.bytes, original?.images[0]?.bytes);
    expectSameBytes(copy?.pdfs[0]?.bytes, original?.pdfs[0]?.bytes);
    expect(copy?.videos[0]?.url).toBe(original?.videos[0]?.url);
    expect(copy?.videos[0]?.source).toBe("vimeo");
    expect(copy?.videos[0]?.bytes).toBeNull();
    expect(copy).not.toHaveProperty("quiz");
    expect(copy?.images[0]?.width).toBe(original?.images[0]?.width);
    expect(copy?.images[0]?.height).toBe(original?.images[0]?.height);
    expect(copy?.images[0]?.byteSize).toBe(original?.images[0]?.byteSize);
    expect(copy?.images[0]?.width).toBe(1);
    expect(copy?.images[0]?.byteSize).toBe(TINY_PNG.byteLength);
  });

  it("omitBytes: true round-trips with all bytes null", async () => {
    const result = await extract(await miniZip());
    const restored = fromJSON(toJSON(result, { omitBytes: true }));

    expect(restored.documents[0]?.images[0]?.bytes).toBeNull();
    expect(restored.schemaVersion).toBe(EXTRACTION_SCHEMA_VERSION);
    expect(restored.documents[0]?.pdfs[0]?.bytes).toBeNull();
    expect(restored.documents[0]?.videos[0]?.bytes).toBeNull();
    expect(restored.documents[0]?.images[0]?.filename).toBe("foto.png");
    expect(restored.documents[0]?.images[0]?.width).toBe(1);
    expect(restored.documents[0]?.images[0]?.height).toBe(1);
    expect(restored.documents[0]?.images[0]?.byteSize).toBe(TINY_PNG.byteLength);
    expect(restored.documents[0]?.videos[0]?.url).toBe(
      "https://player.vimeo.com/video/1",
    );
  });

  it("rejects unknown bytes encoding", async () => {
    const result = await extract(await miniZip());
    const json = toJSON(result);
    const image = json.documents[0]?.images[0];
    if (image) {
      image.bytes = { encoding: "hex" as "base64", data: "00" };
    }
    expect(() => fromJSON(json)).toThrow(InvalidInputError);
    try {
      fromJSON(json);
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidInputError);
      expect((error as InvalidInputError).message).toMatch(/hex/);
      expect((error as InvalidInputError).message).toMatch(/base64/);
    }
  });

  it("keeps schemaVersion through toJSON even with omitBytes", async () => {
    const result = await extract(await miniZip());
    expect(toJSON(result).schemaVersion).toBe(EXTRACTION_SCHEMA_VERSION);
    expect(toJSON(result, { omitBytes: true }).schemaVersion).toBe(
      EXTRACTION_SCHEMA_VERSION,
    );
  });

  it("exports a Zod schema that accepts toJSON() output", async () => {
    const result = await extract(await miniZip(), {
      includeBytes: { images: true },
    });
    const parsed = extractionResultJSONSchema.parse(toJSON(result));
    expect(parsed.documents[0]?.images[0]?.bytes?.encoding).toBe("base64");
  });
});
