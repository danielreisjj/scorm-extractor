import { describe, expect, it } from "vitest";
import {
  isDecorativeLine,
  isPlausibleTitle,
  normalizeExtractedText,
} from "../../src/infrastructure/parsers/html/text-normalizer.js";
import { firstPlausibleHeading } from "../../src/infrastructure/parsers/html/screen-title.js";

describe("text-normalizer", () => {
  it("drops decorative separator lines", () => {
    const text = normalizeExtractedText("Introdução\n\n— –\n\nO módulo começa aqui.");
    expect(text).toBe("Introdução\n\nO módulo começa aqui.");
    expect(isDecorativeLine("— –")).toBe(true);
    expect(isDecorativeLine("---")).toBe(true);
    expect(isDecorativeLine("Atletismo")).toBe(false);
  });
});

describe("firstPlausibleHeading", () => {
  it("ignores paragraph-length headings and keeps a short title", () => {
    const html = `
      <h4>No infográfico a seguir, você entenderá um pouco mais sobre como ensinar a prática do Atletismo em várias dimensões do desenvolvimento motor.</h4>
      <h1 class="titulo-secao">Provas do atletismo</h1>
    `;
    expect(firstPlausibleHeading(html)).toBe("Provas do atletismo");
  });

  it("rejects decorative headings", () => {
    expect(firstPlausibleHeading("<h1>— –</h1><p>Corpo</p>")).toBe("");
    expect(isPlausibleTitle("— –")).toBe(false);
  });
});
