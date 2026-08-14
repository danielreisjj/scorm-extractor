import type { PackageReader } from "../../../domain/ports.js";

const QUIZ_JSON = /(?:^|\/)resources\/m\d+\/quiz\/quiz-[^/]+\.json$/i;

export type AstQuizOption = {
  label: string;
  value: string;
  correct: boolean;
};

export type AstQuizQuestion = {
  title: string;
  descriptionHtml: string;
  imageUrl: string;
  options: AstQuizOption[];
  positiveFeedbackTitle: string;
  positiveFeedbackText: string;
  negativeFeedbackTitle: string;
  negativeFeedbackText: string;
};

export type AstQuiz = {
  id: string;
  initialTitle: string;
  initialText: string;
  initialImageUrl: string;
  initialButtonLabel: string;
  questions: AstQuizQuestion[];
};

export async function loadQuizzes(
  reader: PackageReader,
): Promise<{ quizzes: AstQuiz[]; warnings: string[] }> {
  const paths = reader.list().filter((name) => QUIZ_JSON.test(name)).sort();
  const quizzes: AstQuiz[] = [];
  const warnings: string[] = [];

  for (const path of paths) {
    try {
      const parsed = parseQuizJson(path, await reader.readText(path));
      if (parsed) quizzes.push(parsed);
    } catch {
      warnings.push(`Could not parse quiz JSON '${path}'`);
    }
  }

  return { quizzes, warnings };
}

export function quizToHtml(quiz: AstQuiz): string {
  const parts: string[] = [];
  if (quiz.initialTitle) parts.push(`<h2>${escapeHtml(quiz.initialTitle)}</h2>`);
  if (quiz.initialText) parts.push(`<p>${escapeHtml(quiz.initialText)}</p>`);
  if (quiz.initialImageUrl) {
    parts.push(`<img src="${escapeAttr(quiz.initialImageUrl)}" alt="">`);
  }
  if (quiz.initialButtonLabel) {
    parts.push(`<p>${escapeHtml(quiz.initialButtonLabel)}</p>`);
  }

  for (const question of quiz.questions) {
    parts.push('<div class="extract-question">');
    if (question.title) parts.push(`<h3>${escapeHtml(question.title)}</h3>`);
    if (question.imageUrl) {
      parts.push(`<img src="${escapeAttr(question.imageUrl)}" alt="">`);
    }
    if (question.descriptionHtml) {
      parts.push(`<div>${question.descriptionHtml}</div>`);
    }
    if (question.options.length > 0) {
      const items = question.options
        .map((option) => {
          const mark = option.correct ? " (correct)" : "";
          return `<li>${escapeHtml(option.label)}${mark}</li>`;
        })
        .join("");
      parts.push(`<ul>${items}</ul>`);
    }
    const positive = joinFeedback(
      question.positiveFeedbackTitle,
      question.positiveFeedbackText,
    );
    const negative = joinFeedback(
      question.negativeFeedbackTitle,
      question.negativeFeedbackText,
    );
    if (positive) parts.push(`<p>Feedback correto: ${escapeHtml(positive)}</p>`);
    if (negative) {
      parts.push(`<p>Feedback incorreto: ${escapeHtml(negative)}</p>`);
    }
    parts.push("</div>");
  }

  return parts.join("");
}

function parseQuizJson(path: string, raw: string): AstQuiz | null {
  const data = JSON.parse(raw) as unknown;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const rec = data as Record<string, unknown>;
  const initial = asRecord(rec.initial_screen);
  const questions = asArray(rec.questions)
    .map((item) => parseQuestion(asRecord(item)))
    .filter((question): question is AstQuizQuestion => question !== null);

  const id = quizIdFromPath(path);
  return {
    id,
    initialTitle: asString(initial.title),
    initialText: asString(initial.text),
    initialImageUrl: asString(initial.image_url),
    initialButtonLabel: asString(initial.button_label),
    questions,
  };
}

function parseQuestion(rec: Record<string, unknown>): AstQuizQuestion | null {
  const title = asString(rec.title);
  const descriptionHtml = asString(rec.description);
  const optionsRaw = asArray(rec.options);
  const rightAnswer = asString(rec.right_answer);
  const options: AstQuizOption[] = optionsRaw.map((item) => {
    const option = asRecord(item);
    const label = asString(option.label) || asString(option.text);
    const value = asString(option.value);
    return {
      label,
      value,
      correct: value !== "" && value === rightAnswer,
    };
  }).filter((option) => option.label.length > 0);

  if (!title && !descriptionHtml && options.length === 0) return null;

  return {
    title,
    descriptionHtml,
    imageUrl: asString(rec.image_url),
    options,
    positiveFeedbackTitle: asString(rec.positive_feedback_title),
    positiveFeedbackText: asString(rec.positive_feedback_text),
    negativeFeedbackTitle: asString(rec.negative_feedback_title),
    negativeFeedbackText: asString(rec.negative_feedback_text),
  };
}

function quizIdFromPath(path: string): string {
  const base = path.replace(/\\/g, "/").split("/").pop() ?? "quiz.json";
  return base.replace(/\.json$/i, "") || "quiz";
}

function joinFeedback(title: string, text: string): string {
  return [title.trim(), text.trim()].filter(Boolean).join(" — ");
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function escapeAttr(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
