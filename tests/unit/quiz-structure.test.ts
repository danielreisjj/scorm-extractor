import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  extract,
  EXTRACTION_SCHEMA_VERSION,
  fromJSON,
  toJSON,
  WarningCode,
} from "../../src/index.js";
import { TINY_PNG } from "../fixtures/mini-hoapp.js";
import {
  MINI_AST_CONTENT,
  MINI_AST_INDEX,
  MINI_IMS_MANIFEST,
} from "../fixtures/mini-ast-onepage.js";

async function astZip(quizJson: string): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("imsmanifest.xml", MINI_IMS_MANIFEST);
  zip.file("index.html", MINI_AST_INDEX);
  zip.file("scripts/js/ast_onepage_actions.js", "/* ast onepage */");
  zip.file("scripts/css/astgrid.css", "/* grid */");
  zip.file("resources/m1/index.html", MINI_AST_CONTENT);
  zip.file("resources/m1/images/foto.png", TINY_PNG);
  zip.file("resources/m1/images/c13-popup.png", TINY_PNG);
  zip.file("resources/m1/videos/aula.mp4", "fake-mp4");
  zip.file("resources/m1/docs/guia.pdf", "%PDF-1.4 mini");
  zip.file("resources/m1/quiz/quiz-1.json", quizJson);
  return zip.generateAsync({ type: "uint8array" });
}

describe("structured quiz field", () => {
  it("splits story context from the trailing prompt and normalizes the key", async () => {
    const result = await extract(
      await astZip(
        JSON.stringify({
          initial_screen: { title: "Quiz", text: "Go", image_url: "", button_label: "Iniciar" },
          questions: [
            {
              title: "HISTÓRIA DE MIGUEL",
              description:
                "Miguel tem 17 anos e viaja sozinho.<br /><br /><b>Que tipo de violência Miguel sofreu?</b>",
              type: "multiple_choice",
              right_answer: "A",
              positive_feedback_text: "Isso mesmo!",
              negative_feedback_text: "Não foi dessa vez.",
              options: [
                { label: "A) Negligência.", value: "A" },
                { label: "B) Violência física.", value: "B" },
              ],
            },
          ],
        }),
      ),
      { includeBytes: { images: false, pdfs: false, videos: false } },
    );

    const quiz = result.documents.find((doc) => doc.kind === "quiz");
    if (quiz?.kind !== "quiz") throw new Error("expected quiz document");
    expect(quiz.quiz.questions).toHaveLength(1);
    const question = quiz.quiz.questions[0];
    expect(question?.type).toBe("choice");
    expect(question?.question).toBe("Que tipo de violência Miguel sofreu?");
    expect(question?.context).toContain("HISTÓRIA DE MIGUEL");
    expect(question?.context).toContain("Miguel tem 17 anos");
    expect(question?.responses).toEqual([
      { text: "A) Negligência.", correct: true },
      { text: "B) Violência física.", correct: false },
    ]);
    expect(question?.feedback).toEqual({
      correct: "Isso mesmo!",
      incorrect: "Não foi dessa vez.",
    });
    expect(result.warnings.filter((warning) => warning.startsWith(WarningCode.UNSUPPORTED_QUIZ_TYPE))).toEqual([]);
    expect(result.warnings.filter((warning) => warning.startsWith(WarningCode.QUIZ_MISSING_ANSWER_KEY))).toEqual([]);
  });

  it("emits type other and unsupported_quiz_type when the authoring type is not choice", async () => {
    const result = await extract(
      await astZip(
        JSON.stringify({
          initial_screen: { title: "Quiz", text: "", image_url: "", button_label: "" },
          questions: [
            {
              title: "Associe",
              description: "Ligue os pares",
              type: "matching",
              options: [
                { label: "A) Um", value: "A" },
                { label: "B) Dois", value: "B" },
              ],
            },
          ],
        }),
      ),
      { includeBytes: { images: false, pdfs: false, videos: false } },
    );

    const quiz = result.documents.find((doc) => doc.kind === "quiz");
    if (quiz?.kind !== "quiz") throw new Error("expected quiz document");
    expect(quiz.quiz.questions[0]?.type).toBe("other");
    expect(quiz.quiz.questions[0]?.question).toContain("Ligue os pares");
    expect(quiz.quiz.questions[0]?.responses.map((response) => response.text)).toEqual([
      "A) Um",
      "B) Dois",
    ]);
    expect(
      result.warnings.some(
        (warning) =>
          warning.startsWith(WarningCode.UNSUPPORTED_QUIZ_TYPE) &&
          warning.includes("matching") &&
          warning.includes("quiz-1"),
      ),
    ).toBe(true);
  });

  it("keeps questions when the answer key is missing and warns quiz_missing_answer_key", async () => {
    const result = await extract(
      await astZip(
        JSON.stringify({
          initial_screen: { title: "Quiz", text: "", image_url: "", button_label: "" },
          questions: [
            {
              title: "Pergunta 1",
              description: "Qual opção?",
              type: "multiple_choice",
              options: [
                { label: "A) Um", value: "A" },
                { label: "B) Dois", value: "B" },
              ],
            },
          ],
        }),
      ),
      { includeBytes: { images: false, pdfs: false, videos: false } },
    );

    const quiz = result.documents.find((doc) => doc.kind === "quiz");
    if (quiz?.kind !== "quiz") throw new Error("expected quiz document");
    expect(quiz.quiz.questions[0]?.type).toBe("choice");
    expect(quiz.quiz.questions[0]?.responses.every((response) => response.correct === false)).toBe(
      true,
    );
    expect(
      result.warnings.some(
        (warning) =>
          warning.startsWith(WarningCode.QUIZ_MISSING_ANSWER_KEY) &&
          warning.includes("quiz-1"),
      ),
    ).toBe(true);
  });

  it("normalizes numeric and status answer flags to boolean correct", async () => {
    const result = await extract(
      await astZip(
        JSON.stringify({
          initial_screen: { title: "Quiz", text: "", image_url: "", button_label: "" },
          questions: [
            {
              description: "Marque a correta",
              type: "choice",
              options: [
                { label: "Errada", value: "A", correct: 0 },
                { label: "Certa", value: "B", status: "correct" },
              ],
            },
          ],
        }),
      ),
      { includeBytes: { images: false, pdfs: false, videos: false } },
    );

    const quiz = result.documents.find((doc) => doc.kind === "quiz");
    if (quiz?.kind !== "quiz") throw new Error("expected quiz document");
    expect(quiz.quiz.questions[0]?.responses).toEqual([
      { text: "Errada", correct: false },
      { text: "Certa", correct: true },
    ]);
    expect(result.warnings).toEqual([]);
  });

  it("round-trips quiz through toJSON/fromJSON", async () => {
    const result = await extract(
      await astZip(
        JSON.stringify({
          initial_screen: { title: "Quiz", text: "", image_url: "", button_label: "" },
          questions: [
            {
              description: "Capital?",
              type: "multiple_choice",
              right_answer: "B",
              options: [
                { label: "A) SP", value: "A" },
                { label: "B) Brasília", value: "B" },
              ],
            },
          ],
        }),
      ),
      { includeBytes: { images: false, pdfs: false, videos: false } },
    );
    const restored = fromJSON(JSON.parse(JSON.stringify(toJSON(result))));
    expect(restored.schemaVersion).toBe(EXTRACTION_SCHEMA_VERSION);
    const quiz = restored.documents.find((doc) => doc.kind === "quiz");
    if (quiz?.kind !== "quiz") throw new Error("expected quiz document");
    expect(quiz.quiz.questions[0]?.responses[1]?.correct).toBe(true);
    expect(restored.documents.filter((doc) => doc.kind === "screen")).toHaveLength(2);
    expect(
      restored.documents.filter((doc) => doc.kind === "screen").every((doc) => !("quiz" in doc)),
    ).toBe(true);
  });
});
