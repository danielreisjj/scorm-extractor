import type { FormatId } from "../../domain/format-id.js";
import type { PackageParser, ParserRegistry } from "../../domain/ports.js";
import { HoappParser } from "./hoapp/parser.js";

export function createParserRegistry(
  extra: PackageParser[] = [],
): ParserRegistry {
  const parsers: PackageParser[] = [new HoappParser(), ...extra];
  return {
    resolve(format: FormatId): PackageParser | undefined {
      return parsers.find((parser) => parser.format === format);
    },
  };
}
