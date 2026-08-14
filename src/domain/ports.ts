import type { FormatId } from "./format-id.js";
import type {
  ExtractionResult,
  ResolvedExtractOptions,
} from "./models.js";

export interface PackageReader {
  list(): string[];
  has(path: string): boolean;
  readText(path: string): Promise<string>;
  readBytes(path: string): Promise<Uint8Array>;
}

export interface FormatDetector {
  detect(reader: PackageReader): Promise<FormatId>;
}

export interface PackageParser {
  readonly format: FormatId;
  parse(
    reader: PackageReader,
    options: ResolvedExtractOptions,
  ): Promise<ExtractionResult>;
}

export interface ParserRegistry {
  resolve(format: FormatId): PackageParser | undefined;
}
