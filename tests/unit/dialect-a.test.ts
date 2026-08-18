import { describe, expect, it } from "vitest";
import { parseDialectA } from "../../src/infrastructure/parsers/hoapp/dialect-a-parser.js";
import { expandComponents } from "../../src/infrastructure/parsers/hoapp/component-expander.js";

const SNIPPET = `
const { Accordion, SectionEditable, MenuItem } = HoApp;
const iCourse = {
	title: \`Módulo 4 - Curso Exemplo\`,
	code: \`TST\`,
	language: \`pt\`,
};
const cmenu1 = new MenuItem(
	'menu1',
	{
  "version": 1,
  "label": "Exemplos"
},
);
const cacc1 = new Accordion(
	'acc1',
	{
  "version": 2,
  "items": [
    {
      "title": "Personagem Exemplo",
      "content": "<p>Texto do acordeão</p>"
    }
  ]
},
);
sections.push(
	new SectionEditable(
		'tela_01',
		{
			position: 6,
			content: \`<as-menu-item id="menu1"></as-menu-item><p>Exemplos</p><as-accordion id="acc1"></as-accordion>\`,
			components: [cacc1],
		}
	)
);
`;

describe("HoApp dialect A", () => {
  it("parses constructors into a shared IR", () => {
    const ir = parseDialectA(SNIPPET);
    expect(ir.course.title).toContain("Curso Exemplo");
    expect(ir.sections).toHaveLength(1);
    expect(ir.components.get("acc1")?.type).toBe("accordion");
    const expanded = expandComponents(ir.sections[0]?.content ?? "", ir.components);
    expect(expanded).toContain("Personagem Exemplo");
    expect(expanded).toContain("Texto do acordeão");
  });
});
