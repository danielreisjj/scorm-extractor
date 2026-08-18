import { describe, expect, it } from "vitest";
import { WarningCode } from "../../src/index.js";
import type { HoappComponent } from "../../src/infrastructure/parsers/hoapp/ir.js";
import { quizFromHoappComponents } from "../../src/infrastructure/parsers/hoapp/quiz.js";

function question(
  data: Record<string, unknown>,
  id = "tela_quiz",
): HoappComponent {
  return { id, type: "question", data };
}

function assessment(
  data: Record<string, unknown>,
  id = "tela_quiz",
): HoappComponent {
  return { id, type: "assessment", data };
}

describe("quizFromHoappComponents", () => {
  it("structures a choice question when the answer key is present on the option", () => {
    const { quiz, warnings } = quizFromHoappComponents("tela_01", [
      question({
        type: "choice",
        question: "Qual a capital?",
        choices: [
          { text: "São Paulo", correct: false },
          { text: "Brasília", correct: true },
        ],
      }),
    ]);

    expect(quiz.questions).toHaveLength(1);
    expect(quiz.questions[0]).toMatchObject({
      type: "choice",
      question: "Qual a capital?",
      context: null,
      feedback: null,
      responses: [
        { text: "São Paulo", correct: false },
        { text: "Brasília", correct: true },
      ],
    });
    expect(warnings).toEqual([]);
  });

  it("keeps all responses.correct false and warns when the answer key is missing", () => {
    const { quiz, warnings } = quizFromHoappComponents("tela_01", [
      question({
        type: "multiple_choice",
        prompt: "Qual opção?",
        options: [{ label: "A) Um" }, { label: "B) Dois" }],
      }),
    ]);

    expect(quiz.questions[0]?.type).toBe("choice");
    expect(quiz.questions[0]?.responses.every((response) => response.correct === false)).toBe(
      true,
    );
    expect(warnings).toEqual([
      expect.stringMatching(
        new RegExp(`^${WarningCode.QUIZ_MISSING_ANSWER_KEY}:.*tela_01`),
      ),
    ]);
  });

  it("applies right_answer as a letter, a 1-based index, or the response text", () => {
    const letter = quizFromHoappComponents("q", [
      question({
        type: "mcq",
        question: "Letra",
        right_answer: "B",
        choices: [{ text: "Um" }, { text: "Dois" }],
      }),
    ]).quiz.questions[0];
    expect(letter?.responses.map((response) => response.correct)).toEqual([false, true]);

    const index = quizFromHoappComponents("q", [
      question({
        type: "mc",
        question: "Número",
        rightAnswer: "1",
        answers: [{ text: "Primeira" }, { text: "Segunda" }],
      }),
    ]).quiz.questions[0];
    expect(index?.responses.map((response) => response.correct)).toEqual([true, false]);

    const text = quizFromHoappComponents("q", [
      question({
        type: "choice",
        question: "Texto",
        correctAnswer: "Brasília",
        items: [{ content: "São Paulo" }, { title: "Brasília" }],
      }),
    ]).quiz.questions[0];
    expect(text?.responses.map((response) => response.correct)).toEqual([false, true]);
  });

  it("recognizes normalizeCorrectFlag variants on correct, status, and evaluate", () => {
    const { quiz, warnings } = quizFromHoappComponents("q", [
      question({
        type: "Multiple-Choice",
        question: "Flags",
        choices: [
          { text: "A", correct: 1 },
          { text: "B", correct: 0 },
          { text: "C", status: "correct" },
          { text: "D", status: "incorrect" },
          { text: "E", evaluate: "yes" },
          { text: "F", evaluate: "no" },
        ],
      }),
    ]);

    expect(quiz.questions[0]?.responses.map((response) => response.correct)).toEqual([
      true,
      false,
      true,
      false,
      true,
      false,
    ]);
    expect(warnings).toEqual([]);
  });

  it("accepts string-only alternatives and numeric value labels", () => {
    const strings = quizFromHoappComponents("q", [
      question({
        type: "choice",
        question: "Strings",
        right_answer: "Dois",
        choices: ["Um", "Dois"],
      }),
    ]).quiz.questions[0];
    expect(strings?.responses).toEqual([
      { text: "Um", correct: false },
      { text: "Dois", correct: true },
    ]);

    const decorative = quizFromHoappComponents("q", [
      question({
        type: "choice",
        question: "Marcador",
        right_answer: "---",
        choices: ["---"],
      }),
    ]).quiz.questions[0];
    expect(decorative?.responses).toEqual([{ text: "---", correct: true }]);

    const numeric = quizFromHoappComponents("q", [
      question({
        type: "choice",
        question: "Valor",
        right_answer: "2",
        choices: [{ value: 1 }, { value: 2 }],
      }),
    ]).quiz.questions[0];
    expect(numeric?.responses.map((response) => response.text)).toEqual(["1", "2"]);
    expect(numeric?.responses[1]?.correct).toBe(true);
  });

  it("drops alternatives whose resolved text is empty", () => {
    const { quiz } = quizFromHoappComponents("q", [
      question({
        type: "choice",
        question: "Filtro",
        right_answer: "A",
        choices: [{ text: "" }, { label: "A) Fica" }, { content: "   " }],
      }),
    ]);
    expect(quiz.questions[0]?.responses).toEqual([{ text: "A) Fica", correct: true }]);
  });

  it("falls back through prompt/title/label/content and context aliases", () => {
    const byPrompt = quizFromHoappComponents("q", [
      question({
        type: "choice",
        prompt: "<p>Pelo prompt</p>",
        scenario: "História do cenário",
        choices: [{ text: "A", correct: true }],
      }),
    ]).quiz.questions[0];
    expect(byPrompt?.question).toBe("Pelo prompt");
    expect(byPrompt?.context).toBe("História do cenário");

    const byTitle = quizFromHoappComponents("q", [
      question({
        type: "choice",
        title: "Pelo título",
        case: "Caso clínico",
        choices: [{ text: "A", correct: true }],
      }),
    ]).quiz.questions[0];
    expect(byTitle?.question).toBe("Pelo título");
    expect(byTitle?.context).toBe("Caso clínico");

    const byLabel = quizFromHoappComponents("q", [
      question({
        interactionType: "choice",
        label: "Pelo label",
        context: "Contexto explícito",
        choices: [{ text: "A", correct: true }],
      }),
    ]).quiz.questions[0];
    expect(byLabel?.question).toBe("Pelo label");
    expect(byLabel?.context).toBe("Contexto explícito");

    const byContent = quizFromHoappComponents("q", [
      question({
        questionType: "choice",
        content: "Pelo content",
        choices: [{ text: "A", correct: true }],
      }),
    ]).quiz.questions[0];
    expect(byContent?.question).toBe("Pelo content");
    expect(byContent?.context).toBeNull();
  });

  it("builds feedback from present aliases and omits it when both sides are empty", () => {
    const withFeedback = quizFromHoappComponents("q", [
      question({
        type: "choice",
        question: "Com feedback",
        correctFeedbackTitle: "Certo",
        correctFeedback: "Boa escolha.",
        negativeFeedbackTitle: "Errado",
        feedbackIncorrect: "Tente de novo.",
        choices: [{ text: "A", correct: true }],
      }),
    ]).quiz.questions[0];
    expect(withFeedback?.feedback).toEqual({
      correct: "Certo — Boa escolha.",
      incorrect: "Errado — Tente de novo.",
    });

    const positiveAliases = quizFromHoappComponents("q", [
      question({
        type: "choice",
        question: "Aliases",
        positiveFeedbackTitle: "Ok",
        positiveFeedback: "Isso.",
        incorrectFeedback: "Não.",
        choices: [{ text: "A", correct: true }],
      }),
    ]).quiz.questions[0];
    expect(positiveAliases?.feedback).toEqual({
      correct: "Ok — Isso.",
      incorrect: "Não.",
    });

    const absent = quizFromHoappComponents("q", [
      question({
        type: "choice",
        question: "Sem feedback",
        choices: [{ text: "A", correct: true }],
      }),
    ]).quiz.questions[0];
    expect(absent?.feedback).toBeNull();
  });

  it("emits type other and unsupported_quiz_type when there are no alternatives", () => {
    const { quiz, warnings } = quizFromHoappComponents("tela_02", [
      question({
        type: "choice",
        question: "Sem alternativas",
      }),
    ]);

    expect(quiz.questions[0]).toMatchObject({
      type: "other",
      question: "Sem alternativas",
      responses: [],
    });
    expect(warnings).toEqual([
      expect.stringMatching(
        new RegExp(`^${WarningCode.UNSUPPORTED_QUIZ_TYPE}:.*choice.*tela_02`),
      ),
    ]);
    expect(warnings.some((warning) => warning.startsWith(WarningCode.QUIZ_MISSING_ANSWER_KEY))).toBe(
      false,
    );
  });

  it("emits type other and a warning for authoring types that are not choice", () => {
    const { quiz, warnings } = quizFromHoappComponents("tela_03", [
      question({
        type: "matching",
        question: "Ligue os pares",
        options: [{ text: "A) Um" }, { text: "B) Dois" }],
      }),
    ]);

    expect(quiz.questions[0]?.type).toBe("other");
    expect(quiz.questions[0]?.responses.map((response) => response.text)).toEqual([
      "A) Um",
      "B) Dois",
    ]);
    expect(warnings).toEqual([
      expect.stringMatching(
        new RegExp(`^${WarningCode.UNSUPPORTED_QUIZ_TYPE}:.*"matching".*tela_03`),
      ),
    ]);
  });

  it("treats a missing authoring type with alternatives as choice, and without them as unknown other", () => {
    const asChoice = quizFromHoappComponents("q", [
      question({
        question: "Implícito",
        choices: [{ text: "A", correct: true }],
      }),
    ]).quiz.questions[0];
    expect(asChoice?.type).toBe("choice");

    const asUnknown = quizFromHoappComponents("tela_04", [
      question({ question: "Sem tipo e sem opções" }),
    ]);
    expect(asUnknown.quiz.questions[0]?.type).toBe("other");
    expect(asUnknown.warnings[0]).toMatch(/"unknown"/);
    expect(asUnknown.warnings[0]).toContain("tela_04");
  });

  it("expands assessment.questions, assessment.items, and a bare assessment payload", () => {
    const nestedQuestions = quizFromHoappComponents("a", [
      assessment({
        questions: [
          {
            type: "choice",
            question: "Q1",
            choices: [{ text: "A", correct: true }],
          },
          {
            type: "choice",
            question: "Q2",
            choices: [{ text: "B", correct: true }],
          },
        ],
      }),
    ]);
    expect(nestedQuestions.quiz.questions.map((item) => item.question)).toEqual(["Q1", "Q2"]);

    const nestedItems = quizFromHoappComponents("a", [
      assessment({
        items: [
          {
            type: "choice",
            question: "Via items",
            choices: [{ text: "A", correct: true }],
          },
        ],
      }),
    ]);
    expect(nestedItems.quiz.questions[0]?.question).toBe("Via items");

    const bare = quizFromHoappComponents("a", [
      assessment({
        type: "choice",
        question: "Assessment direto",
        choices: [{ text: "A", correct: true }],
      }),
    ]);
    expect(bare.quiz.questions[0]?.question).toBe("Assessment direto");
  });

  it("skips non-quiz components and emits a single missing-key warning for the screen", () => {
    const { quiz, warnings } = quizFromHoappComponents("tela_05", [
      { id: "vid", type: "video", data: { path: "aula.mp4" } },
      question({
        type: "choice",
        question: "Sem gabarito",
        choices: [{ text: "A" }, { text: "B" }],
      }),
      question({
        type: "fill-in",
        question: "Complete",
        choices: [{ text: "x" }],
      }),
    ]);

    expect(quiz.questions).toHaveLength(2);
    expect(quiz.questions[0]?.type).toBe("choice");
    expect(quiz.questions[1]?.type).toBe("other");
    expect(warnings.filter((warning) => warning.startsWith(WarningCode.QUIZ_MISSING_ANSWER_KEY))).toHaveLength(
      1,
    );
    expect(warnings.filter((warning) => warning.startsWith(WarningCode.UNSUPPORTED_QUIZ_TYPE))).toHaveLength(
      1,
    );
  });
});
