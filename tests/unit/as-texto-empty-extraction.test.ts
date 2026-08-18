import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { extract, WarningCode } from "../../src/index.js";
import {
  EMPTY_EXTRACTION_MIN_AVG_CHARS,
  EMPTY_EXTRACTION_MIN_DOCUMENTS,
  usefulTextLength,
} from "../../src/application/suspicious-empty-extraction.js";

function dialectBPackage(screens: Array<{ id: string; html: string }>): string {
  const bodies = screens
    .map(
      (screen, index) => `
sections.push({
	id: '${screen.id}',
	data: {
		position: ${index + 1},
		content: \`${screen.html}\`,
	},
});`,
    )
    .join("\n");
  return `
const { Course } = HoApp;
const iCourse = { title: \`Pacote teste\`, code: \`T\`, language: \`pt\` };
${bodies}
`;
}

async function zipFromDataJs(dataJs: string): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("js/data.js", dataJs);
  return zip.generateAsync({ type: "uint8array" });
}

describe("HoApp dialect B as-texto extraction", () => {
  it("linearizes data.value from as-texto stubs through extract()", async () => {
    const dataJs = `
const c97875 = {
	id: '97875',
	type: 'as-texto',
	data: {"value":"<p>Olá! Sejam bem-vindos &agrave; <strong>LGPD</strong>.</p>"},
};
components.push(c97875);
const ce86c = {
	id: 'e86c',
	type: 'as-video',
	data: {"videoType":"VIMEO","path":"https://player.vimeo.com/video/1","title":"Intro"},
};
components.push(ce86c);
sections.push({
	id: 'tela_01',
	data: {
		position: 1,
		content: \`<as-texto id="97875"></as-texto><as-video id="e86c"></as-video>\`,
	},
});
const iCourse = { title: \`LGPD\`, code: \`COB\`, language: \`pt\` };
`;
    const result = await extract(await zipFromDataJs(dataJs));
    const screen = result.documents[0];
    expect(screen?.text).toContain("Olá! Sejam bem-vindos à LGPD.");
    expect(screen?.text).toContain("[VIDEO_0]");
    expect(screen?.videos).toHaveLength(1);
    expect(
      result.warnings.some((warning) =>
        warning.startsWith(WarningCode.SUSPICIOUS_EMPTY_EXTRACTION),
      ),
    ).toBe(false);
  });
});

describe("suspicious_empty_extraction warning", () => {
  it("does not fire for fewer than the document threshold", async () => {
    const screens = Array.from({ length: EMPTY_EXTRACTION_MIN_DOCUMENTS - 1 }, (_, i) => ({
      id: `tela_0${i + 1}`,
      html: `<p></p>`,
    }));
    const result = await extract(await zipFromDataJs(dialectBPackage(screens)));
    expect(result.documents).toHaveLength(EMPTY_EXTRACTION_MIN_DOCUMENTS - 1);
    expect(
      result.warnings.some((warning) =>
        warning.startsWith(WarningCode.SUSPICIOUS_EMPTY_EXTRACTION),
      ),
    ).toBe(false);
  });

  it("fires when many screens have almost no useful text", async () => {
    const screens = Array.from({ length: EMPTY_EXTRACTION_MIN_DOCUMENTS }, (_, i) => ({
      id: `tela_0${i + 1}`,
      html: i === 0 ? `<p>Avançar</p>` : `<p></p>`,
    }));
    const result = await extract(await zipFromDataJs(dialectBPackage(screens)));
    expect(result.documents).toHaveLength(EMPTY_EXTRACTION_MIN_DOCUMENTS);
    const avg =
      result.documents.reduce((sum, doc) => sum + usefulTextLength(doc.text), 0) /
      result.documents.length;
    expect(avg).toBeLessThan(EMPTY_EXTRACTION_MIN_AVG_CHARS);
    expect(
      result.warnings.some(
        (warning) =>
          warning.startsWith(WarningCode.SUSPICIOUS_EMPTY_EXTRACTION) &&
          warning.includes(`${EMPTY_EXTRACTION_MIN_DOCUMENTS} screens`),
      ),
    ).toBe(true);
  });

  it("does not fire for a short course that still has real copy", async () => {
    const copy =
      "Objetivos de aprendizagem desta aula incluem compreender o tema com profundidade suficiente.";
    const screens = Array.from({ length: 7 }, (_, i) => ({
      id: `tela_0${i + 1}`,
      html: `<p>${copy}</p>`,
    }));
    const result = await extract(await zipFromDataJs(dialectBPackage(screens)));
    expect(result.documents).toHaveLength(7);
    expect(
      result.warnings.some((warning) =>
        warning.startsWith(WarningCode.SUSPICIOUS_EMPTY_EXTRACTION),
      ),
    ).toBe(false);
  });
});
