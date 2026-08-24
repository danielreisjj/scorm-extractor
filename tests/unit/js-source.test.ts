import { describe, expect, it } from "vitest";
import { InvalidPackageError } from "../../src/domain/errors.js";
import {
  extractBalanced,
  extractTemplateLiteral,
  readJsNumberField,
  readJsStringField,
} from "../../src/infrastructure/parsers/hoapp/js-source.js";

describe("extractBalanced", () => {
  it("extracts nested objects, arrays, and parentheses", () => {
    expect(extractBalanced("{ a: { b: [1, 2] } }", 0)).toBe("{ a: { b: [1, 2] } }");
    expect(extractBalanced("prefix [1, [2], 3] suffix", 7)).toBe("[1, [2], 3]");
    expect(extractBalanced("fn(1, (2 + 3))", 2)).toBe("(1, (2 + 3))");
  });

  it("ignores braces that sit inside quoted strings (single, double, template)", () => {
    expect(extractBalanced(`{ a: "}" }`, 0)).toBe(`{ a: "}" }`);
    expect(extractBalanced(`{ a: '}' }`, 0)).toBe(`{ a: '}' }`);
    expect(extractBalanced("{ a: `}` }", 0)).toBe("{ a: `}` }");
  });

  it("treats escaped quotes as content, not string closers", () => {
    const doubleQuoted = '{ a: "say \\"}\\"" }';
    const singleQuoted = "{ a: 'say \\'}\\'' }";
    const templated = "{ a: `say \\`}\\`` }";
    expect(extractBalanced(doubleQuoted, 0)).toBe(doubleQuoted);
    expect(extractBalanced(singleQuoted, 0)).toBe(singleQuoted);
    expect(extractBalanced(templated, 0)).toBe(templated);
  });

  it("skips line comments so a brace in the comment does not close the literal", () => {
    const source = "{ a: 1, // }\nb: 2 }";
    expect(extractBalanced(source, 0)).toBe(source);
  });

  it("skips a line comment that runs to end of input", () => {
    expect(() => extractBalanced("{ a: 1 // no newline and no closer", 0)).toThrow(
      InvalidPackageError,
    );
    expect(() => extractBalanced("{ a: 1 // no newline and no closer", 0)).toThrow(
      /Unbalanced delimiters/,
    );
  });

  it("skips block comments, including an unclosed one that then fails as unbalanced", () => {
    expect(extractBalanced("{ a: 1, /* } */ b: 2 }", 0)).toBe("{ a: 1, /* } */ b: 2 }");
    expect(() => extractBalanced("{ a: 1, /* never closed", 0)).toThrow(/Unbalanced delimiters/);
  });

  it("rejects a start character that is not a delimiter", () => {
    expect(() => extractBalanced("foo { bar }", 0)).toThrow(InvalidPackageError);
    expect(() => extractBalanced("foo { bar }", 0)).toThrow(/Expected a balanced/);
  });

  it("rejects truncated or unbalanced literals", () => {
    expect(() => extractBalanced("{ a: 1", 0)).toThrow(/Unbalanced delimiters/);
    expect(() => extractBalanced("{ a: { b: 1 }", 0)).toThrow(/Unbalanced delimiters/);
    expect(() => extractBalanced("[1, 2", 0)).toThrow(/Unbalanced delimiters/);
  });
});

describe("extractTemplateLiteral", () => {
  it("returns the inner text and honours escaped backticks", () => {
    expect(extractTemplateLiteral("`hello {world}`", 0)).toBe("hello {world}");
    expect(extractTemplateLiteral("`a\\`b`", 0)).toBe("a\\`b");
  });

  it("fails on an unterminated template", () => {
    expect(() => extractTemplateLiteral("`no closer", 0)).toThrow(InvalidPackageError);
    expect(() => extractTemplateLiteral("`no closer", 0)).toThrow(
      /Unterminated template literal/,
    );
  });
});

describe("readJsStringField / readJsNumberField", () => {
  it("reads backtick, single-quoted, and double-quoted string fields", () => {
    expect(readJsStringField("{ title: `Módulo` }", "title")).toBe("Módulo");
    expect(readJsStringField("{ title: 'Curso' }", "title")).toBe("Curso");
    expect(readJsStringField('{ title: "Texto" }', "title")).toBe("Texto");
  });

  it("returns empty string when the field is absent", () => {
    expect(readJsStringField("{ code: `TST` }", "title")).toBe("");
  });

  it("propagates unterminated template literals from a backtick field", () => {
    expect(() => readJsStringField("{ title: `oops }", "title")).toThrow(
      /Unterminated template literal/,
    );
  });

  it("reads integers, negatives, decimals, and defaults missing numbers to 0", () => {
    expect(readJsNumberField("{ position: 6 }", "position")).toBe(6);
    expect(readJsNumberField("{ position: -3 }", "position")).toBe(-3);
    expect(readJsNumberField("{ position: 1.5 }", "position")).toBe(1.5);
    expect(readJsNumberField("{ position: 2 }", "other")).toBe(0);
  });
});
