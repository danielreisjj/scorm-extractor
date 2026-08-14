import * as cheerio from "cheerio";
import type {
  Quiz,
  QuizFeedback,
  QuizQuestion,
  QuizResponse,
} from "../../../domain/models.js";
import { WarningCode, formatWarning } from "../../../domain/warning-codes.js";
import { normalizeExtractedText } from "../html/text-normalizer.js";

const CHOICE_TYPE_ALIASES = new Set([
  "choice",
  "multiplechoice",
  "multiplechoise",
  "mcq",
  "mc",
]);

const GENERIC_PROMPT_TITLE = /^(?:pergunta|questão|questao|question|q)\s*\d+$/i;

/**
 * True when the authoring `type` is multiple-choice (or omitted, which AST
 * packages treat as choice when `options[]` is present).
 */
export function isChoiceAuthoringType(raw: string): boolean {
  const normalized = raw.trim().toLowerCase().replace(/[\s_-]+/g, "");
  return normalized === "" || CHOICE_TYPE_ALIASES.has(normalized);
}

/**
 * Normalize authoring correct-flags (boolean, 1/0, "correct"/"incorrect", …).
 * Returns `undefined` when the value is not a recognizable key.
 */
export function normalizeCorrectFlag(value: unknown): boolean | undefined {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (
      normalized === "correct" ||
      normalized === "true" ||
      normalized === "yes" ||
      normalized === "right" ||
      normalized === "1"
    ) {
      return true;
    }
    if (
      normalized === "incorrect" ||
      normalized === "false" ||
      normalized === "no" ||
      normalized === "wrong" ||
      normalized === "0"
    ) {
      return false;
    }
  }
  return undefined;
}

export function htmlToPlainText(html: string): string {
  if (!html.trim()) return "";
  const $ = cheerio.load(`<div id="extract-root">${html}</div>`);
  $("#extract-root").find("br").replaceWith("\n");
  return normalizeExtractedText($("#extract-root").text());
}

/**
 * Split an HTML description into a preceding story (`context`) and the
 * prompt (`question`). AST COB quizzes wrap the prompt in a trailing `<b>`.
 */
export function splitQuestionAndContext(descriptionHtml: string): {
  question: string;
  context: string | null;
} {
  if (!descriptionHtml.trim()) {
    return { question: "", context: null };
  }
  const $ = cheerio.load(`<div id="extract-root">${descriptionHtml}</div>`);
  $("#extract-root").find("br").replaceWith("\n");
  const prompt = $("#extract-root").find("b, strong").last();
  if (prompt.length > 0) {
    const question = normalizeExtractedText(prompt.text());
    prompt.remove();
    const context = normalizeExtractedText($("#extract-root").text());
    if (question && context && context !== question) {
      return { question, context };
    }
    if (question) return { question, context: context || null };
  }
  return { question: htmlToPlainText(descriptionHtml), context: null };
}

export function mergeCaseTitle(
  title: string,
  context: string | null,
  question: string,
): string | null {
  const heading = title.trim();
  if (!heading || GENERIC_PROMPT_TITLE.test(heading)) return context;
  if (context) {
    if (context.toLowerCase().startsWith(heading.toLowerCase())) return context;
    return `${heading}\n\n${context}`;
  }
  if (question.toLowerCase().startsWith(heading.toLowerCase())) return null;
  return heading;
}

export function joinFeedbackParts(title: string, text: string): string | null {
  const joined = [title.trim(), text.trim()].filter(Boolean).join(" — ");
  return joined || null;
}

export function buildFeedback(input: {
  correctTitle?: string;
  correctText?: string;
  incorrectTitle?: string;
  incorrectText?: string;
}): QuizFeedback | null {
  const correct = joinFeedbackParts(
    input.correctTitle ?? "",
    input.correctText ?? "",
  );
  const incorrect = joinFeedbackParts(
    input.incorrectTitle ?? "",
    input.incorrectText ?? "",
  );
  if (!correct && !incorrect) return null;
  return { correct, incorrect };
}

export function applyAnswerKey(
  responses: QuizResponse[],
  rightAnswer: string,
): { responses: QuizResponse[]; hasKey: boolean } {
  if (responses.length === 0) {
    return { responses, hasKey: false };
  }
  if (responses.some((response) => response.correct)) {
    return { responses, hasKey: true };
  }
  const key = rightAnswer.trim();
  if (!key) {
    return { responses, hasKey: false };
  }
  const matched = responses.map((response, index) => ({
    ...response,
    correct: matchesRightAnswer(response, index, key),
  }));
  return { responses: matched, hasKey: matched.some((response) => response.correct) };
}

function matchesRightAnswer(
  response: QuizResponse,
  index: number,
  key: string,
): boolean {
  const normalizedKey = key.trim().toLowerCase();
  if (!normalizedKey) return false;
  const letter = String.fromCharCode(65 + index);
  if (normalizedKey === letter.toLowerCase()) return true;
  if (normalizedKey === String(index + 1)) return true;
  const text = response.text.trim().toLowerCase();
  if (text === normalizedKey) return true;
  if (text.startsWith(`${normalizedKey})`)) return true;
  return false;
}

export function unsupportedQuizTypeWarning(
  documentId: string,
  detectedType: string,
): string {
  const detected = detectedType.trim() || "unknown";
  return formatWarning(
    WarningCode.UNSUPPORTED_QUIZ_TYPE,
    `unrecognized type "${detected}" in ${documentId}`,
  );
}

export function missingAnswerKeyWarning(documentId: string): string {
  return formatWarning(
    WarningCode.QUIZ_MISSING_ANSWER_KEY,
    `no identifiable answer key in ${documentId}; all responses.correct are false`,
  );
}

export function quizFromQuestions(
  questions: QuizQuestion[],
): Quiz {
  return { questions };
}
