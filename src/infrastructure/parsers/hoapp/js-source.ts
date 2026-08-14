import { InvalidPackageError } from "../../../domain/errors.js";

export function extractBalanced(source: string, openIndex: number): string {
  const open = source[openIndex];
  const close = open === "{" ? "}" : open === "[" ? "]" : open === "(" ? ")" : null;
  if (!open || !close) {
    throw new InvalidPackageError("Expected a balanced '{', '[' or '('");
  }

  let depth = 0;
  let quote: string | null = null;
  let escape = false;

  for (let i = openIndex; i < source.length; i += 1) {
    const char = source[i];
    if (quote) {
      if (escape) {
        escape = false;
      } else if (char === "\\") {
        escape = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "/" && source[i + 1] === "/") {
      const newline = source.indexOf("\n", i);
      i = newline < 0 ? source.length : newline;
      continue;
    }
    if (char === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i + 2);
      i = end < 0 ? source.length : end + 1;
      continue;
    }
    if (char === open) depth += 1;
    else if (char === close) {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openIndex, i + 1);
      }
    }
  }

  throw new InvalidPackageError("Unbalanced delimiters in js/data.js");
}

export function extractTemplateLiteral(source: string, openBacktick: number): string {
  let escape = false;
  for (let i = openBacktick + 1; i < source.length; i += 1) {
    const char = source[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === "\\") {
      escape = true;
      continue;
    }
    if (char === "`") {
      return source.slice(openBacktick + 1, i);
    }
  }
  throw new InvalidPackageError("Unterminated template literal in js/data.js");
}

export function indexOfUnquoted(source: string, needle: string, from = 0): number {
  let quote: string | null = null;
  let escape = false;
  for (let i = from; i < source.length; i += 1) {
    const char = source[i];
    if (quote) {
      if (escape) escape = false;
      else if (char === "\\") escape = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (source.startsWith(needle, i)) return i;
  }
  return -1;
}

export function readJsStringField(objectSource: string, field: string): string {
  const backtick = new RegExp(`${field}\\s*:\\s*\``).exec(objectSource);
  if (backtick && backtick.index !== undefined) {
    const open = objectSource.indexOf("`", backtick.index);
    return extractTemplateLiteral(objectSource, open);
  }
  const quoted = new RegExp(`${field}\\s*:\\s*(['"])(.*?)\\1`).exec(objectSource);
  return quoted?.[2] ?? "";
}

export function readJsNumberField(objectSource: string, field: string): number {
  const match = new RegExp(`${field}\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`).exec(objectSource);
  return match?.[1] ? Number(match[1]) : 0;
}
