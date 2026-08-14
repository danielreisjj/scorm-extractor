import { InvalidPackageError } from "../../../domain/errors.js";
import {
  extractBalanced,
  extractTemplateLiteral,
  readJsNumberField,
  readJsStringField,
} from "./js-source.js";
import {
  asRecord,
  typeFromConstructor,
  type HoappComponent,
  type HoappIR,
  type HoappSection,
} from "./ir.js";

const CONSTRUCTORS =
  /new\s+(Accordion|Assessment|FlipCard|ImageMap|LockByClick|MenuItem|Modal|Question|Slider|TabsEditable|VideoEditable)\(\s*(['"])([^'"]+)\2/g;

export function parseDialectA(dataJs: string): HoappIR {
  const components = new Map<string, HoappComponent>();

  for (const match of dataJs.matchAll(CONSTRUCTORS)) {
    const ctor = match[1];
    const id = match[3];
    if (!ctor || !id || match.index === undefined) continue;
    const afterId = dataJs.indexOf(",", match.index + match[0].length);
    const objectStart = dataJs.indexOf("{", afterId);
    if (objectStart < 0) continue;
    const literal = extractBalanced(dataJs, objectStart);
    let data: Record<string, unknown>;
    try {
      data = asRecord(JSON.parse(literal));
    } catch {
      throw new InvalidPackageError(`Could not parse HoApp component '${id}'`);
    }
    components.set(id, {
      id,
      type: typeFromConstructor(ctor),
      data,
    });
  }

  const sections = parseSectionsA(dataJs);
  if (sections.length === 0) {
    throw new InvalidPackageError("HoApp package has no sections");
  }

  return {
    course: parseCourse(dataJs),
    components,
    sections,
  };
}

function parseSectionsA(dataJs: string): HoappSection[] {
  const sections: HoappSection[] = [];
  const starter = /new\s+SectionEditable\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = starter.exec(dataJs))) {
    const idMatch = dataJs.slice(match.index + match[0].length).match(/^\s*(['"])([^'"]+)\1/);
    const id = idMatch?.[2];
    if (!id) continue;
    const objectStart = dataJs.indexOf("{", match.index + match[0].length);
    if (objectStart < 0) continue;
    const objectLiteral = extractBalanced(dataJs, objectStart);
    const contentKey = objectLiteral.search(/content\s*:\s*`/);
    const content =
      contentKey >= 0
        ? extractTemplateLiteral(objectLiteral, objectLiteral.indexOf("`", contentKey))
        : "";
    sections.push({
      id,
      position: readJsNumberField(objectLiteral, "position"),
      content,
    });
  }
  return sections;
}

export function parseCourse(dataJs: string): HoappIR["course"] {
  const marker = /const\s+iCourse\s*=\s*\{/.exec(dataJs);
  if (!marker || marker.index === undefined) {
    return { title: "", code: "", language: "" };
  }
  const open = dataJs.indexOf("{", marker.index);
  const literal = extractBalanced(dataJs, open);
  return {
    title: readJsStringField(literal, "title"),
    code: readJsStringField(literal, "code"),
    language: readJsStringField(literal, "language") || "pt",
  };
}
