import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { ZodError } from "zod";
import {
  InvalidInputError,
  InvalidPackageError,
  IoError,
  isScormExtractorError,
} from "../domain/errors.js";
import {
  EXTRACTION_SCHEMA_VERSION,
  extractionResultSchema,
  resolveExtractOptions,
  type ExtractOptions,
  type ExtractionResult,
} from "../domain/models.js";
import type {
  FormatDetector,
  PackageReader,
  ParserRegistry,
} from "../domain/ports.js";
import { suspiciousEmptyExtractionWarning } from "./suspicious-empty-extraction.js";

export type ExtractSource = string | URL | Uint8Array | Buffer;

export interface ExtractDependencies {
  openPackage: (
    bytes: Uint8Array,
    options: { maxUncompressedBytes: number },
  ) => Promise<PackageReader>;
  detector: FormatDetector;
  registry: ParserRegistry;
}

export async function extractPackage(
  source: ExtractSource,
  options: ExtractOptions,
  deps: ExtractDependencies,
): Promise<ExtractionResult> {
  let resolved;
  try {
    resolved = resolveExtractOptions(options);
  } catch (error) {
    throw wrapOptionsError(error);
  }

  const bytes = await loadSource(source);
  const reader = await deps.openPackage(bytes, {
    maxUncompressedBytes: resolved.maxUncompressedBytes,
  });
  const format = await deps.detector.detect(reader);
  const parser = deps.registry.resolve(format);
  if (!parser) {
    throw new InvalidPackageError(
      `No parser registered for format "${format}". Register a PackageParser in the registry.`,
    );
  }
  const result = await parser.parse(reader, resolved);
  const emptyWarning = suspiciousEmptyExtractionWarning(result.documents);
  const warnings = emptyWarning
    ? [...result.warnings, emptyWarning]
    : result.warnings;
  try {
    return extractionResultSchema.parse({
      ...result,
      warnings,
      schemaVersion: EXTRACTION_SCHEMA_VERSION,
    });
  } catch (error) {
    throw new InvalidPackageError(
      "Parser produced an ExtractionResult that failed schema validation",
      { cause: error },
    );
  }
}

async function loadSource(source: ExtractSource): Promise<Uint8Array> {
  if (typeof source === "string") {
    try {
      return await readFile(source);
    } catch (error) {
      throw mapFsError(error, source);
    }
  }
  if (source instanceof URL) {
    if (source.protocol !== "file:") {
      throw new InvalidInputError(
        `Only file: URLs are supported as extract() source (got ${source.protocol}). Pass a file path, Buffer, or Uint8Array instead.`,
      );
    }
    try {
      return await readFile(fileURLToPath(source));
    } catch (error) {
      throw mapFsError(error, source.href);
    }
  }
  if (source instanceof Uint8Array || Buffer.isBuffer(source)) {
    return source;
  }
  throw new InvalidInputError(
    "extract() source must be a file path string, file: URL, Uint8Array, or Buffer",
  );
}

function mapFsError(error: unknown, path: string): never {
  if (isScormExtractorError(error)) throw error;
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: string }).code)
      : "";
  if (code === "ENOENT") {
    throw new IoError(
      `Could not read package: file not found (${path})`,
      { cause: error },
    );
  }
  if (code === "EACCES" || code === "EPERM") {
    throw new IoError(
      `Could not read package: permission denied (${path})`,
      { cause: error },
    );
  }
  const detail = error instanceof Error ? error.message : "unreadable path";
  throw new IoError(`Could not read package: ${detail}`, { cause: error });
}

function wrapOptionsError(error: unknown): InvalidInputError {
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    const path = issue?.path?.join(".") || "options";
    return new InvalidInputError(
      `Invalid extract() options at "${path}": ${issue?.message ?? "validation failed"}`,
      { cause: error },
    );
  }
  if (isScormExtractorError(error)) {
    return error as InvalidInputError;
  }
  return new InvalidInputError("Invalid extract() options", { cause: error });
}
