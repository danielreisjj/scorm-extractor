import { describe, expect, it } from "vitest";
import {
  applyAnswerKey,
  isChoiceAuthoringType,
  normalizeCorrectFlag,
} from "../../src/infrastructure/parsers/quiz/choice.js";

describe("normalizeCorrectFlag", () => {
  it.each([
    [true, true],
    [1, true],
    ["correct", true],
    ["TRUE", true],
    [" yes ", true],
    ["Right", true],
    ["1", true],
    [false, false],
    [0, false],
    ["incorrect", false],
    ["FALSE", false],
    ["no", false],
    ["Wrong", false],
    ["0", false],
  ] as const)("maps %j to %s", (input, expected) => {
    expect(normalizeCorrectFlag(input)).toBe(expected);
  });

  it("returns undefined for values that are not a recognizable key", () => {
    expect(normalizeCorrectFlag(undefined)).toBeUndefined();
    expect(normalizeCorrectFlag(null)).toBeUndefined();
    expect(normalizeCorrectFlag("maybe")).toBeUndefined();
    expect(normalizeCorrectFlag(2)).toBeUndefined();
    expect(normalizeCorrectFlag({})).toBeUndefined();
  });
});

describe("isChoiceAuthoringType", () => {
  it("treats omitted and known aliases as choice", () => {
    expect(isChoiceAuthoringType("")).toBe(true);
    expect(isChoiceAuthoringType("choice")).toBe(true);
    expect(isChoiceAuthoringType("multiple_choice")).toBe(true);
    expect(isChoiceAuthoringType("Multiple-Choise")).toBe(true);
    expect(isChoiceAuthoringType("MCQ")).toBe(true);
    expect(isChoiceAuthoringType("mc")).toBe(true);
  });

  it("rejects authoring types that are not multiple-choice", () => {
    expect(isChoiceAuthoringType("matching")).toBe(false);
    expect(isChoiceAuthoringType("fill-in")).toBe(false);
    expect(isChoiceAuthoringType("true-false")).toBe(false);
  });
});

describe("applyAnswerKey", () => {
  const responses = [
    { text: "A) Azul", correct: false },
    { text: "B) Verde", correct: false },
  ];

  it("returns hasKey false for an empty response list", () => {
    expect(applyAnswerKey([], "A")).toEqual({ responses: [], hasKey: false });
  });

  it("keeps existing correct flags and does not re-match the key", () => {
    const flagged = [
      { text: "Um", correct: false },
      { text: "Dois", correct: true },
    ];
    expect(applyAnswerKey(flagged, "A")).toEqual({ responses: flagged, hasKey: true });
  });

  it("returns hasKey false when no option is flagged and the key is blank", () => {
    expect(applyAnswerKey(responses, "   ")).toEqual({ responses, hasKey: false });
  });

  it("matches a letter, a 1-based index, exact text, or a 'key)' prefix", () => {
    expect(applyAnswerKey(responses, "B").responses.map((response) => response.correct)).toEqual([
      false,
      true,
    ]);
    expect(applyAnswerKey(responses, "1").responses.map((response) => response.correct)).toEqual([
      true,
      false,
    ]);
    expect(
      applyAnswerKey(
        [
          { text: "São Paulo", correct: false },
          { text: "Brasília", correct: false },
        ],
        "brasília",
      ).responses.map((response) => response.correct),
    ).toEqual([false, true]);
    expect(
      applyAnswerKey(responses, "a").responses.map((response) => response.correct),
    ).toEqual([true, false]);
    expect(
      applyAnswerKey(
        [{ text: "sim) concordo", correct: false }],
        "sim",
      ).responses.map((response) => response.correct),
    ).toEqual([true]);
  });

  it("returns hasKey false when the key matches no response", () => {
    const result = applyAnswerKey(responses, "Z");
    expect(result.hasKey).toBe(false);
    expect(result.responses.every((response) => response.correct === false)).toBe(true);
  });
});
