import { InvalidPackageError } from "../../../domain/errors.js";
import {
  extractBalanced,
  extractTemplateLiteral,
  readJsNumberField,
} from "./js-source.js";
import { parseCourse } from "./dialect-a-parser.js";
import {
  asRecord,
  typeFromAsTag,
  type HoappComponent,
  type HoappIR,
  type HoappSection,
} from "./ir.js";

const COMPONENT =
  /const\s+[A-Za-z0-9_$]+\s*=\s*\{\s*id:\s*(['"])([^'"]+)\1\s*,\s*type:\s*(['"])([^'"]+)\3/g;

export function parseDialectB(dataJs: string): HoappIR {
  const components = new Map<string, HoappComponent>();

  for (const match of dataJs.matchAll(COMPONENT)) {
    const id = match[2];
    const asType = match[4];
    if (!id || !asType || match.index === undefined) continue;
    const dataIndex = dataJs.indexOf("data:", match.index);
    if (dataIndex < 0 || dataIndex > match.index + 400) continue;
    const objectStart = dataJs.indexOf("{", dataIndex);
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
      type: typeFromAsTag(asType),
      data,
    });
  }

  const sections = parseSectionsB(dataJs);
  if (sections.length === 0) {
    throw new InvalidPackageError("HoApp package has no sections");
  }

  return {
    course: parseCourse(dataJs),
    components,
    sections,
  };
}

function parseSectionsB(dataJs: string): HoappSection[] {
  const sections: HoappSection[] = [];
  const starter = /sections\.push\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = starter.exec(dataJs))) {
    const objectStart = dataJs.indexOf("{", match.index);
    if (objectStart < 0) continue;
    const objectLiteral = extractBalanced(dataJs, objectStart);
    const idMatch = objectLiteral.match(/id:\s*(['"])([^'"]+)\1/);
    const id = idMatch?.[2];
    if (!id) continue;
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
