import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { extract, EXTRACTION_SCHEMA_VERSION, toJSON } from "../../src/index.js";
import { base64ToUint8 } from "../../src/serialize.js";
import {
  MINI_HOAPP_DATA_JS,
  MINI_QUIZ_DATA_JS,
  TINY_PNG,
} from "../fixtures/mini-hoapp.js";

describe("extract() synthetic HoApp zip", () => {
  it("extracts markers from in-memory bytes", async () => {
    const zip = new JSZip();
    zip.file("js/data.js", MINI_HOAPP_DATA_JS);
    zip.file("midias/imagens/foto.png", TINY_PNG);
    zip.file("midias/docs/a.pdf", "%PDF-1.4 mini");
    zip.file("_telas/tela_01.html", "<p>ignored</p>");
    const bytes = await zip.generateAsync({ type: "uint8array" });

    const result = await extract(bytes);

    expect(result.format).toBe("hoapp");
    expect(result.schemaVersion).toBe(EXTRACTION_SCHEMA_VERSION);
    expect(result.documents).toHaveLength(1);
    const screen = result.documents[0];
    expect(screen?.kind).toBe("screen");
    expect(screen).not.toHaveProperty("title");
    expect(screen).not.toHaveProperty("quiz");
    expect(screen?.text).toContain("[IMAGE_0]");
    expect(screen?.text).toContain("[PDF_0]");
    expect(screen?.text).toContain("[VIDEO_0]");
    expect(screen?.text.match(/Duplicado/g)).toHaveLength(1);
    expect(screen?.images[0]?.bytes).toBeInstanceOf(Uint8Array);
    expect(screen?.images[0]?.filename).toBe("foto.png");
    expect(screen?.images[0]?.width).toBe(1);
    expect(screen?.images[0]?.height).toBe(1);
    expect(screen?.images[0]?.byteSize).toBe(TINY_PNG.byteLength);
    expect(screen?.pdfs[0]?.bytes).toBeInstanceOf(Uint8Array);
    expect(screen?.pdfs[0]?.filename).toBe("a.pdf");
    expect(screen?.videos[0]?.source).toBe("vimeo");
    expect(screen?.pdfs[0]?.originalPath).toBe("midias/docs/a.pdf");
  });

  it("omits image bytes when includeBytes.images is false", async () => {
    const zip = new JSZip();
    zip.file("js/data.js", MINI_HOAPP_DATA_JS);
    zip.file("midias/imagens/foto.png", TINY_PNG);
    zip.file("_telas/tela_01.html", "<p></p>");
    const result = await extract(
      await zip.generateAsync({ type: "uint8array" }),
      { includeBytes: { images: false, pdfs: false } },
    );
    expect(result.documents[0]?.images[0]?.bytes).toBeNull();
    expect(result.documents[0]?.images[0]?.width).toBe(1);
    expect(result.documents[0]?.images[0]?.byteSize).toBe(TINY_PNG.byteLength);
  });

  it("serializes bytes via toJSON", async () => {
    const zip = new JSZip();
    zip.file("js/data.js", MINI_HOAPP_DATA_JS);
    zip.file("midias/imagens/foto.png", TINY_PNG);
    zip.file("_telas/tela_01.html", "<p></p>");
    const result = await extract(
      await zip.generateAsync({ type: "uint8array" }),
    );
    const json = toJSON(result);
    const encoded = json.documents[0]?.images[0]?.bytes;
    expect(encoded).toEqual({
      encoding: "base64",
      data: expect.any(String),
    });
    if (encoded) {
      const roundtrip = base64ToUint8(encoded.data);
      expect(roundtrip[0]).toBe(0x89);
    }
  });

  it("marks quiz screens and expands question choices", async () => {
    const zip = new JSZip();
    zip.file("js/data.js", MINI_QUIZ_DATA_JS);
    zip.file("_telas/tela_quiz.html", "<p></p>");
    const result = await extract(
      await zip.generateAsync({ type: "uint8array" }),
    );
    const doc = result.documents[0];
    expect(doc?.kind).toBe("quiz");
    expect(doc?.text).toContain("Qual é a capital?");
    expect(doc?.text).toContain("Brasília");
    expect(doc?.text).toContain("(correct)");
    expect(doc?.text).toContain("São Paulo");
    if (doc?.kind !== "quiz") throw new Error("expected quiz document");
    expect(doc.quiz.questions).toHaveLength(1);
    expect(doc.quiz.questions[0]).toMatchObject({
      type: "choice",
      question: "Qual é a capital?",
      context: null,
      responses: [
        { text: "São Paulo", correct: false },
        { text: "Brasília", correct: true },
        { text: "Rio", correct: false },
      ],
    });
  });
});
