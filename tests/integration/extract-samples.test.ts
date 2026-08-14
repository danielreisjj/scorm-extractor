import { describe, expect, it } from "vitest";
import { extract } from "../../src/index.js";
import { base64ToUint8, toJSON } from "../../src/serialize.js";
import {
  SAMPLE_PACKAGES,
  sampleExists,
  samplePath,
} from "../helpers/sample-packages.js";
import { writeExtractionOutput } from "../helpers/write-extraction-output.js";
import type { ExtractionResult } from "../../src/domain/models.js";

describe("extract() sample ZIPs", () => {
  for (const sample of SAMPLE_PACKAGES) {
    it.skipIf(!sampleExists(sample.file))(
      `${sample.name}: writes output JSON and keeps marker/ref invariants`,
      async () => {
        const result = await extract(samplePath(sample.file), {
          includeBytes: sample.includeBytes,
        });
        await writeExtractionOutput(sample.name, result);
        assertExtractionShape(result);
        assertSampleExpectations(sample.name, result);
      },
    );
  }
});

function assertExtractionShape(result: ExtractionResult): void {
  expect(result.format).toBeTruthy();
  expect(result.documents.length).toBeGreaterThanOrEqual(8);
  for (const doc of result.documents) {
    expect(["screen", "quiz"]).toContain(doc.kind);
    expect(doc).not.toHaveProperty("title");
    assertRefsMatchText(doc.text, doc.images, "IMAGE");
    assertRefsMatchText(doc.text, doc.pdfs, "PDF");
    assertRefsMatchText(doc.text, doc.videos, "VIDEO");
  }
}

function assertSampleExpectations(name: string, result: ExtractionResult): void {
  if (name === "Atletismo_M04") {
    const text = allText(result);
    expect(text).toContain("Adhemar Ferreira da Silva");
    expect(text).toContain("Arremessos e lançamentos");
    expect(text).toContain("Clique para baixar as atividades");
    expect(
      result.documents.some((doc) =>
        doc.videos.some((video) => video.source === "vimeo"),
      ),
    ).toBe(true);
    expect(result.documents.some((doc) => doc.pdfs.length > 0)).toBe(true);
    assertNoChromeImages(result);
    assertImageBytesMagic(result);
    return;
  }

  if (name === "Novo_CIEVO_M02") {
    const pdfPaths = result.documents.flatMap((doc) =>
      doc.pdfs.map((pdf) => pdf.originalPath),
    );
    expect(pdfPaths).toContain(
      "midias/docs/m02_base_nacional_comum_curricular_tabela.pdf",
    );
    expect(pdfPaths).toContain("midias/docs/m02_empatia_e_cooperacao.pdf");
    return;
  }

  if (name === "Atletismo_M05" || name === "Novo_CIEVO_M03") {
    expect(result.documents.some((doc) => doc.pdfs.length > 0)).toBe(true);
    if (name === "Atletismo_M05") assertNoChromeImages(result);
    return;
  }

  if (name === "Novo_CIEVO_M01") {
    expect(
      result.warnings.some((warning) => warning.includes("leftover template")),
    ).toBe(true);
  }
}

function assertRefsMatchText(
  text: string,
  assets: { ref: string }[],
  kind: "IMAGE" | "PDF" | "VIDEO",
): void {
  const inText = [...text.matchAll(new RegExp(`\\[${kind}_(\\d+)\\]`, "g"))].map(
    (match) => `${kind}_${match[1]}`,
  );
  const inArray = assets.map((asset) => asset.ref);
  expect([...inArray].sort()).toEqual([...inText].sort());
}

function assertNoChromeImages(result: ExtractionResult): void {
  for (const doc of result.documents) {
    for (const image of doc.images) {
      const path = image.originalPath.toLowerCase();
      expect(path).not.toContain("midias/interface/");
      expect(path).not.toContain("midias/bg/");
      expect(path).not.toMatch(/(?:^|\/)(?:logo|marca|vazio)[-_.]/);
      expect(image).not.toHaveProperty("role");
    }
  }
}

function assertImageBytesMagic(result: ExtractionResult): void {
  const image = result.documents
    .flatMap((doc) => doc.images)
    .find((item) => item.bytes);
  expect(image?.bytes).toBeTruthy();
  const bytes = image?.bytes ?? new Uint8Array();
  const png =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  expect(png || jpeg).toBe(true);

  const encoded = toJSON(result).documents
    .flatMap((doc) => doc.images)
    .find((item) => item.bytes)?.bytes;
  expect(encoded?.encoding).toBe("base64");
  if (encoded) {
    const roundtrip = base64ToUint8(encoded.data);
    expect(roundtrip[0]).toBe(bytes[0]);
  }
}

function allText(result: ExtractionResult): string {
  return result.documents.map((doc) => doc.text).join("\n");
}
