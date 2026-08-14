import type { Quiz, QuizQuestion, QuizResponse } from "../../../domain/models.js";
import {
  applyAnswerKey,
  buildFeedback,
  htmlToPlainText,
  isChoiceAuthoringType,
  missingAnswerKeyWarning,
  normalizeCorrectFlag,
  quizFromQuestions,
  unsupportedQuizTypeWarning,
} from "../quiz/choice.js";
import {
  asArray,
  asRecord,
  asString,
  isQuizComponentType,
  type HoappComponent,
} from "./ir.js";

export function quizFromHoappComponents(
  documentId: string,
  components: HoappComponent[],
): { quiz: Quiz; warnings: string[] } {
  const questions: QuizQuestion[] = [];
  const warnings: string[] = [];
  let missingKey = false;

  for (const component of components) {
    if (!isQuizComponentType(component.type)) continue;
    const items =
      component.type === "assessment"
        ? questionsFromAssessment(component.data)
        : [component.data];
    for (const data of items) {
      const parsed = structureHoappQuestion(data, documentId);
      questions.push(parsed.question);
      warnings.push(...parsed.warnings);
      if (parsed.missingAnswerKey) missingKey = true;
    }
  }

  if (missingKey) warnings.push(missingAnswerKeyWarning(documentId));
  return { quiz: quizFromQuestions(questions), warnings };
}

function questionsFromAssessment(data: Record<string, unknown>): Record<string, unknown>[] {
  const nested = asArray(data.questions ?? data.items).map(asRecord);
  return nested.length > 0 ? nested : [data];
}

function structureHoappQuestion(
  data: Record<string, unknown>,
  documentId: string,
): { question: QuizQuestion; warnings: string[]; missingAnswerKey: boolean } {
  const authoringType = asString(data.type ?? data.interactionType ?? data.questionType);
  const questionText =
    htmlToPlainText(asString(data.question)) ||
    htmlToPlainText(asString(data.prompt)) ||
    htmlToPlainText(asString(data.title)) ||
    htmlToPlainText(asString(data.label)) ||
    htmlToPlainText(asString(data.content));
  const contextRaw =
    htmlToPlainText(asString(data.context)) ||
    htmlToPlainText(asString(data.scenario)) ||
    htmlToPlainText(asString(data.case));
  const context = contextRaw || null;
  const feedback = buildFeedback({
    correctTitle: asString(data.correctFeedbackTitle ?? data.positiveFeedbackTitle),
    correctText: asString(
      data.correctFeedback ?? data.positiveFeedback ?? data.feedbackCorrect,
    ),
    incorrectTitle: asString(data.incorrectFeedbackTitle ?? data.negativeFeedbackTitle),
    incorrectText: asString(
      data.incorrectFeedback ?? data.negativeFeedback ?? data.feedbackIncorrect,
    ),
  });
  const rawResponses = collectResponses(data);
  const rightAnswer = asString(data.right_answer ?? data.rightAnswer ?? data.correctAnswer);

  if (rawResponses.length > 0 && isChoiceAuthoringType(authoringType)) {
    const keyed = applyAnswerKey(rawResponses, rightAnswer);
    return {
      question: {
        type: "choice",
        question: questionText,
        context,
        responses: keyed.responses,
        feedback,
      },
      warnings: [],
      missingAnswerKey: !keyed.hasKey,
    };
  }

  const detected = authoringType || "unknown";
  return {
    question: {
      type: "other",
      question: questionText,
      context,
      responses: rawResponses,
      feedback,
    },
    warnings: [unsupportedQuizTypeWarning(documentId, detected)],
    missingAnswerKey: false,
  };
}

function collectResponses(data: Record<string, unknown>): QuizResponse[] {
  const raw = asArray(data.choices ?? data.answers ?? data.options ?? data.items);
  return raw
    .map((item) => {
      if (typeof item === "string") {
        return { text: htmlToPlainText(item) || item, correct: false };
      }
      const rec = asRecord(item);
      const text =
        htmlToPlainText(asString(rec.text)) ||
        htmlToPlainText(asString(rec.label)) ||
        htmlToPlainText(asString(rec.content)) ||
        htmlToPlainText(asString(rec.title)) ||
        (typeof rec.value === "number" ? String(rec.value) : asString(rec.value));
      const flagged =
        normalizeCorrectFlag(rec.correct) ??
        normalizeCorrectFlag(rec.status) ??
        normalizeCorrectFlag(rec.evaluate);
      return { text, correct: flagged === true };
    })
    .filter((response) => response.text.length > 0);
}
