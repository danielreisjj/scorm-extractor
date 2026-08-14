import { describe, expect, it } from "vitest";
import { parseDialectA } from "../../src/infrastructure/parsers/hoapp/dialect-a-parser.js";
import { expandComponents } from "../../src/infrastructure/parsers/hoapp/component-expander.js";

const SNIPPET = `
const { Accordion, SectionEditable, MenuItem } = HoApp;
const iCourse = {
	title: \`Módulo 4 - Atletismo\`,
	code: \`COB\`,
	language: \`pt\`,
};
const cacba = new MenuItem(
	'acba',
	{
  "version": 1,
  "label": "Ídolos"
},
);
const cde4e = new Accordion(
	'de4e',
	{
  "version": 2,
  "items": [
    {
      "title": "Adhemar Ferreira da Silva",
      "content": "<p>Salto triplo</p>"
    }
  ]
},
);
sections.push(
	new SectionEditable(
		'tela_06',
		{
			position: 6,
			content: \`<as-menu-item id="acba"></as-menu-item><p>Ídolos</p><as-accordion id="de4e"></as-accordion>\`,
			components: [cde4e],
		}
	)
);
`;

describe("HoApp dialect A", () => {
  it("parses constructors into a shared IR", () => {
    const ir = parseDialectA(SNIPPET);
    expect(ir.course.title).toContain("Atletismo");
    expect(ir.sections).toHaveLength(1);
    expect(ir.components.get("de4e")?.type).toBe("accordion");
    const expanded = expandComponents(ir.sections[0]?.content ?? "", ir.components);
    expect(expanded).toContain("Adhemar Ferreira da Silva");
    expect(expanded).toContain("Salto triplo");
  });
});
