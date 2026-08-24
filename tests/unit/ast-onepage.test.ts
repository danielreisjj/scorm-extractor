import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { extract } from "../../src/index.js";
import { findZipContentRoot } from "../../src/infrastructure/zip-content-root.js";
import { MINI_HOAPP_DATA_JS, TINY_PNG } from "../fixtures/mini-hoapp.js";
import {
  MINI_AST_CONTENT,
  MINI_AST_INDEX,
  MINI_AST_QUIZ_JSON,
  MINI_IMS_MANIFEST,
} from "../fixtures/mini-ast-onepage.js";

async function zipWith(files: Record<string, string | Uint8Array>): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content);
  }
  return zip.generateAsync({ type: "uint8array" });
}

describe("nested ZIP content root", () => {
  it("keeps a package already rooted at the ZIP root", () => {
    expect(
      findZipContentRoot(["imsmanifest.xml", "js/data.js", "index.html"]),
    ).toBe("");
  });

  it("unwraps a first-level envelope folder", () => {
    expect(
      findZipContentRoot([
        "Pacote/imsmanifest.xml",
        "Pacote/js/data.js",
        "Pacote/index.html",
      ]),
    ).toBe("Pacote");
  });

  it("unwraps a unique deeper manifest (Pacote/Pacote/imsmanifest.xml)", () => {
    expect(
      findZipContentRoot([
        "Pacote/Pacote/imsmanifest.xml",
        "Pacote/Pacote/js/data.js",
      ]),
    ).toBe("Pacote/Pacote");
  });

  it("extracts a nested HoApp ZIP the same as a rooted one", async () => {
    const nested = await zipWith({
      "Pacote/imsmanifest.xml": MINI_IMS_MANIFEST,
      "Pacote/js/data.js": MINI_HOAPP_DATA_JS,
      "Pacote/midias/imagens/foto.png": TINY_PNG,
      "Pacote/midias/docs/a.pdf": "%PDF-1.4 mini",
      "Pacote/_telas/tela_01.html": "<p>ignored</p>",
    });
    const rooted = await zipWith({
      "js/data.js": MINI_HOAPP_DATA_JS,
      "midias/imagens/foto.png": TINY_PNG,
      "midias/docs/a.pdf": "%PDF-1.4 mini",
      "_telas/tela_01.html": "<p>ignored</p>",
    });

    const nestedResult = await extract(nested);
    const rootedResult = await extract(rooted);

    expect(nestedResult.format).toBe("hoapp");
    expect(nestedResult.documents).toHaveLength(rootedResult.documents.length);
    expect(nestedResult.documents[0]?.text).toBe(rootedResult.documents[0]?.text);
    expect(nestedResult.documents[0]?.images[0]?.originalPath).toBe(
      "midias/imagens/foto.png",
    );
  });
});

describe("extract() synthetic AST OnePage zip", () => {
  async function miniAst(extra: Record<string, string | Uint8Array> = {}) {
    return zipWith({
      "imsmanifest.xml": MINI_IMS_MANIFEST,
      "index.html": MINI_AST_INDEX,
      "scripts/js/ast_onepage_actions.js": "/* ast onepage */",
      "scripts/css/astgrid.css": "/* grid */",
      "resources/m1/index.html": MINI_AST_CONTENT,
      "resources/m1/images/foto.png": TINY_PNG,
      "resources/m1/images/imagem01.png": TINY_PNG,
      "resources/m1/images/logo.png": TINY_PNG,
      "resources/interface/nav.png": TINY_PNG,
      "resources/m1/videos/aula.mp4": "fake-mp4",
      "resources/m1/docs/guia.pdf": "%PDF-1.4 mini",
      ...extra,
    });
  }

  it("linearizes screens, flip-card backs, popup images, local video and PDF", async () => {
    const result = await extract(await miniAst(), {
      includeBytes: { images: false, pdfs: false, videos: false },
    });

    expect(result.format).toBe("ast-onepage");
    expect(result.course.title).toBe("Curso AST Mini");
    expect(result.course.language).toBe("pt");
    expect(result.documents).toHaveLength(2);
    expect(result.documents.map((doc) => doc.id)).toEqual(["c1", "c2"]);
    expect(result.documents.every((doc) => doc.kind === "screen")).toBe(true);
    expect(result.documents[0]).not.toHaveProperty("title");
    expect(result.documents[0]).not.toHaveProperty("quiz");

    const intro = result.documents[0];
    expect(intro?.text).toContain("Introdução");
    expect(intro?.text).toContain("Texto do verso do flip-card");
    expect(intro?.text).toContain("[IMAGE_0]");
    expect(intro?.images).toHaveLength(1);
    expect(intro?.images[0]?.originalPath).toBe("resources/m1/images/foto.png");
    expect(intro?.images[0]?.width).toBe(1);
    expect(intro?.images[0]?.height).toBe(1);
    expect(intro?.images[0]?.byteSize).toBe(TINY_PNG.byteLength);
    expect(intro?.images[0]?.bytesStatus).toBe("omitted");
    expect(intro?.images.some((image) => image.originalPath.includes("logo"))).toBe(
      false,
    );
    expect(
      intro?.images.some((image) => image.originalPath.includes("interface")),
    ).toBe(false);

    const media = result.documents[1];
    expect(media?.text).toContain("[VIDEO_0]");
    expect(media?.text).toContain("[PDF_0]");
    expect(media?.text).toContain("[IMAGE_0]");
    expect(media?.videos[0]).toMatchObject({
      ref: "VIDEO_0",
      source: "local",
      mimeType: "video/mp4",
      originalPath: "resources/m1/videos/aula.mp4",
      filename: "aula.mp4",
      bytesStatus: "omitted",
    });
    expect(media?.pdfs[0]?.originalPath).toBe("resources/m1/docs/guia.pdf");
    expect(media?.images[0]?.originalPath).toBe(
      "resources/m1/images/imagem01.png",
    );
  });

  it("appends a quiz screen when quiz JSON is present", async () => {
    const result = await extract(
      await miniAst({
        "resources/m1/quiz/quiz-1.json": MINI_AST_QUIZ_JSON,
      }),
      { includeBytes: { images: false, pdfs: false, videos: false } },
    );

    const quiz = result.documents.find((doc) => doc.kind === "quiz");
    expect(quiz?.id).toBe("quiz-1");
    expect(quiz?.text).toContain("Quiz final");
    expect(quiz?.text).toContain("Qual é a capital?");
    expect(quiz?.text).toContain("Brasília");
    expect(quiz?.text).toContain("(correct)");
    expect(quiz?.text).toContain("São Paulo");
    expect(quiz?.text).toContain("Resposta correta.");
    expect(quiz?.text).toContain("Tente de novo.");
    expect(quiz?.text).toContain("[IMAGE_0]");
    expect(quiz?.images.length).toBeGreaterThan(0);
    if (quiz?.kind !== "quiz") throw new Error("expected quiz document");
    expect(quiz.quiz.questions).toHaveLength(1);
    expect(quiz.quiz.questions[0]).toMatchObject({
      type: "choice",
      question: "Qual é a capital?",
      context: null,
      responses: [
        { text: "A) São Paulo", correct: false },
        { text: "B) Brasília", correct: true },
      ],
      feedback: {
        correct: "Parabéns — Resposta correta.",
        incorrect: "Ops — Tente de novo.",
      },
    });
  });

  it("ignores a missing quiz without error", async () => {
    const result = await extract(await miniAst());
    expect(result.documents.some((doc) => doc.kind === "quiz")).toBe(false);
    expect(result.warnings).toEqual([]);
  });

  it("loads image, PDF and local video bytes when includeBytes is true", async () => {
    const result = await extract(await miniAst(), {
      includeBytes: { images: true, pdfs: true, videos: true },
    });
    const intro = result.documents[0];
    expect(intro?.images[0]?.bytesStatus).toBe("present");
    expect(intro?.images[0]?.bytes).toBeInstanceOf(Uint8Array);
    expect(intro?.images[0]?.mimeType).toBe("image/png");
    expect(intro?.images[0]?.width).toBe(1);
    expect(intro?.images[0]?.height).toBe(1);
    expect(intro?.images[0]?.byteSize).toBe(TINY_PNG.byteLength);

    const media = result.documents[1];
    expect(media?.pdfs[0]).toMatchObject({
      mimeType: "application/pdf",
      originalPath: "resources/m1/docs/guia.pdf",
      bytesStatus: "present",
    });
    expect(media?.pdfs[0]?.bytes).toBeInstanceOf(Uint8Array);
    expect(media?.videos[0]).toMatchObject({
      source: "local",
      mimeType: "video/mp4",
      originalPath: "resources/m1/videos/aula.mp4",
      bytesStatus: "present",
    });
    expect(media?.videos[0]?.bytes).toBeInstanceOf(Uint8Array);
  });

  it("marks missing AST image, PDF and local video and warns", async () => {
    const result = await extract(
      await zipWith({
        "imsmanifest.xml": MINI_IMS_MANIFEST,
        "index.html": MINI_AST_INDEX,
        "scripts/js/ast_onepage_actions.js": "/* ast onepage */",
        "scripts/css/astgrid.css": "/* grid */",
        "resources/m1/index.html": MINI_AST_CONTENT,
      }),
    );
    const intro = result.documents[0];
    expect(intro?.images[0]?.bytesStatus).toBe("missing");
    expect(intro?.images[0]?.bytes).toBeNull();
    expect(intro?.images[0]?.width).toBeNull();
    const media = result.documents[1];
    expect(media?.pdfs[0]?.bytesStatus).toBe("missing");
    expect(media?.videos[0]?.bytesStatus).toBe("missing");
    expect(media?.videos[0]?.source).toBe("local");
    expect(result.warnings.some((warning) => warning.includes("Missing image"))).toBe(
      true,
    );
    expect(result.warnings.some((warning) => warning.includes("Missing PDF"))).toBe(
      true,
    );
    expect(result.warnings.some((warning) => warning.includes("Missing video"))).toBe(
      true,
    );
  });

  it("keeps AST iframe Vimeo/YouTube as remote videos", async () => {
    const html = `<!doctype html>
<html lang="pt"><body>
<div id="c1" class="container">
  <iframe src="https://player.vimeo.com/video/1"></iframe>
  <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>
</div>
</body></html>`;
    const result = await extract(
      await zipWith({
        "imsmanifest.xml": MINI_IMS_MANIFEST,
        "index.html": MINI_AST_INDEX,
        "scripts/js/ast_onepage_actions.js": "/* ast onepage */",
        "scripts/css/astgrid.css": "/* grid */",
        "resources/m1/index.html": html,
      }),
      { includeBytes: { videos: true } },
    );
    expect(result.documents[0]?.videos).toEqual([
      expect.objectContaining({
        source: "vimeo",
        url: "https://player.vimeo.com/video/1",
        bytes: null,
        bytesStatus: "remote",
        originalPath: null,
      }),
      expect.objectContaining({
        source: "youtube",
        url: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        bytes: null,
        bytesStatus: "remote",
        originalPath: null,
      }),
    ]);
  });

  it("extracts a nested AST OnePage envelope", async () => {
    const bytes = await zipWith({
      "Curso/imsmanifest.xml": MINI_IMS_MANIFEST,
      "Curso/index.html": MINI_AST_INDEX,
      "Curso/scripts/js/ast_onepage_actions.min.js": "/* ast */",
      "Curso/scripts/css/astgrid.css": "/* grid */",
      "Curso/resources/m1/index.html": MINI_AST_CONTENT,
      "Curso/resources/m1/images/foto.png": TINY_PNG,
      "Curso/resources/m1/images/imagem01.png": TINY_PNG,
      "Curso/resources/m1/videos/aula.mp4": "fake-mp4",
      "Curso/resources/m1/docs/guia.pdf": "%PDF-1.4 mini",
    });
    const result = await extract(bytes, {
      includeBytes: { images: false, pdfs: false, videos: false },
    });
    expect(result.format).toBe("ast-onepage");
    expect(result.documents).toHaveLength(2);
    expect(result.documents[1]?.videos[0]?.originalPath).toBe(
      "resources/m1/videos/aula.mp4",
    );
  });
});
