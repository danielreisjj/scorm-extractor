import { describe, expect, it } from "vitest";
import { parseDialectB } from "../../src/infrastructure/parsers/hoapp/dialect-b-parser.js";
import { expandComponents } from "../../src/infrastructure/parsers/hoapp/component-expander.js";

const SNIPPET = `
const cvid1 = {
	id: 'vid1',
	type: 'as-video',
	data: {"version":2,"videoType":"VIMEO","path":"https://player.vimeo.com/video/123","title":"Vídeo Exemplo"},
};
const ctab1 = {
	id: 'tab1',
	type: 'as-abas',
	data: {"version":1,"items":[{"title":1,"content":"<p>Texto da primeira aba</p>"}]},
};
sections.push({
	id: 'sec_a',
	data: {
		position: 12,
		content: \`<as-video id="vid1"></as-video><as-abas id="tab1"></as-abas>\`,
		components: [cvid1, ctab1],
	},
});
const { Course } = HoApp;
const iCourse = {
	title: \`Curso Exemplo\`,
	code: \`TST\`,
	language: \`pt\`,
};
`;

describe("HoApp dialect B", () => {
  it("parses object literals into the same IR shape", () => {
    const ir = parseDialectB(SNIPPET);
    expect(ir.course.code).toBe("TST");
    expect(ir.components.get("vid1")?.type).toBe("video");
    expect(ir.sections[0]?.id).toBe("sec_a");
    const expanded = expandComponents(ir.sections[0]?.content ?? "", ir.components);
    expect(expanded).toContain("data-extract-video=\"vid1\"");
    expect(expanded).toContain("Texto da primeira aba");
  });

  it("injects as-texto data.value into empty stubs", () => {
    const ir = parseDialectB(`
const c1001 = {
	id: '1001',
	type: 'as-texto',
	data: {"style":"texto-subtitulo","value":"<p>Olá! Sejam bem-vindos ao Curso Exemplo.</p>"},
};
components.push(c1001);
sections.push({
	id: '2001',
	data: {
		position: 3,
		content: \`<as-texto id="1001" :asdata="section.getComponent('1001')"></as-texto>\`,
	},
});
const iCourse = { title: \`Curso Exemplo\`, code: \`TST\`, language: \`pt\` };
`);
    expect(ir.components.get("1001")?.type).toBe("text");
    const expanded = expandComponents(ir.sections[0]?.content ?? "", ir.components);
    expect(expanded).toContain("Olá! Sejam bem-vindos ao Curso Exemplo.");
    expect(expanded).not.toContain("<as-texto");
  });
});
