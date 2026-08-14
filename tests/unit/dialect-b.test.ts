import { describe, expect, it } from "vitest";
import { parseDialectB } from "../../src/infrastructure/parsers/hoapp/dialect-b-parser.js";
import { expandComponents } from "../../src/infrastructure/parsers/hoapp/component-expander.js";

const SNIPPET = `
const ce86c = {
	id: 'e86c',
	type: 'as-video',
	data: {"version":2,"videoType":"VIMEO","path":"https://player.vimeo.com/video/1110081348","title":"Respeito"},
};
const c304c = {
	id: '304c',
	type: 'as-abas',
	data: {"version":1,"items":[{"title":1,"content":"<p>Não satisfaça todas as vontades</p>"}]},
};
sections.push({
	id: 'tela_12_video',
	data: {
		position: 12,
		content: \`<as-video id="e86c"></as-video><as-abas id="304c"></as-abas>\`,
		components: [ce86c, c304c],
	},
});
const { Course } = HoApp;
const iCourse = {
	title: \`Curso de Iniciação Esportiva e Valores Olímpicos - CIEVO\`,
	code: \`COB\`,
	language: \`pt\`,
};
`;

describe("HoApp dialect B", () => {
  it("parses object literals into the same IR shape", () => {
    const ir = parseDialectB(SNIPPET);
    expect(ir.course.code).toBe("COB");
    expect(ir.components.get("e86c")?.type).toBe("video");
    expect(ir.sections[0]?.id).toBe("tela_12_video");
    const expanded = expandComponents(ir.sections[0]?.content ?? "", ir.components);
    expect(expanded).toContain("data-extract-video=\"e86c\"");
    expect(expanded).toContain("Não satisfaça todas as vontades");
  });
});
