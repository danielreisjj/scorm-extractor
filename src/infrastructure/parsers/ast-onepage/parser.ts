import { InvalidPackageError } from "../../../domain/errors.js";
import { AST_ONEPAGE_FORMAT } from "../../../domain/format-id.js";
import {
  EXTRACTION_SCHEMA_VERSION,
  type ExtractedDocument,
  type ExtractionResult,
  type Quiz,
  type ResolvedExtractOptions,
} from "../../../domain/models.js";
import type { PackageParser, PackageReader } from "../../../domain/ports.js";
import { AssetLoader } from "../../asset-loader.js";
import { loadLinearizedMedia } from "../../load-linearized-media.js";
import { linearizeHtml } from "../html/html-linearizer.js";
import {
  readContentHtml,
  readCourseMeta,
  readRootHtml,
  splitScreens,
} from "./content.js";
import { astQuizToStructured, loadQuizzes, quizToHtml } from "./quiz.js";

export class AstOnepageParser implements PackageParser {
  readonly format = AST_ONEPAGE_FORMAT;

  async parse(
    reader: PackageReader,
    options: ResolvedExtractOptions,
  ): Promise<ExtractionResult> {
    const { path, html } = await readContentHtml(reader);
    const screens = splitScreens(html);
    if (screens.length === 0) {
      throw new InvalidPackageError(
        "AST OnePage package has no screens (div#cN / .container)",
      );
    }

    const rootHtml = await readRootHtml(reader);
    const course = await readCourseMeta(reader, html, rootHtml);
    const basePath = dirname(path);
    const loader = new AssetLoader(reader);
    const warnings: string[] = [];

    const documents: ExtractedDocument[] = [];
    for (const screen of screens) {
      documents.push(
        await documentFromHtml(
          screen.id,
          screen.position,
          "screen",
          screen.html,
          basePath,
          loader,
          options,
          warnings,
        ),
      );
    }

    const { quizzes, warnings: quizWarnings } = await loadQuizzes(reader);
    warnings.push(...quizWarnings);
    let position = documents.length;
    for (const quiz of quizzes) {
      position += 1;
      const structured = astQuizToStructured(quiz, quiz.id);
      warnings.push(...structured.warnings);
      documents.push(
        await documentFromHtml(
          quiz.id,
          position,
          "quiz",
          quizToHtml(quiz),
          basePath,
          loader,
          options,
          warnings,
          structured.quiz,
        ),
      );
    }

    return {
      schemaVersion: EXTRACTION_SCHEMA_VERSION,
      format: AST_ONEPAGE_FORMAT,
      warnings,
      course,
      documents,
    };
  }
}

async function documentFromHtml(
  id: string,
  position: number,
  kind: ExtractedDocument["kind"],
  html: string,
  basePath: string,
  loader: AssetLoader,
  options: ResolvedExtractOptions,
  warnings: string[],
  quiz?: Quiz,
): Promise<ExtractedDocument> {
  const linearized = linearizeHtml(html, {
    videosById: new Map(),
    basePath,
  });
  const { images, pdfs, videos } = await loadLinearizedMedia(
    linearized,
    loader,
    options.includeBytes,
    warnings,
    id,
  );
  if (kind === "quiz") {
    return {
      id,
      position,
      kind,
      text: linearized.text,
      quiz: quiz ?? { questions: [] },
      images,
      pdfs,
      videos,
    };
  }
  return {
    id,
    position,
    kind,
    text: linearized.text,
    images,
    pdfs,
    videos,
  };
}

function dirname(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const index = normalized.lastIndexOf("/");
  return index < 0 ? "" : normalized.slice(0, index);
}
