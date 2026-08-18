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
    expect(isDecorativeLine("Curso Exemplo")).toBe(false);
  });
});

describe("firstPlausibleHeading", () => {
  it("ignores paragraph-length headings and keeps a short title", () => {
    const html = `
      <h4>No diagrama a seguir, você entenderá um pouco mais sobre como aplicar o conteúdo da aula em várias dimensões do aprendizado prático diário.</h4>
      <h1 class="titulo-secao">Tópicos da aula</h1>
    `;
    expect(firstPlausibleHeading(html)).toBe("Tópicos da aula");
  });

  it("rejects decorative headings", () => {
    expect(firstPlausibleHeading("<h1>— –</h1><p>Corpo</p>")).toBe("");
    expect(isPlausibleTitle("— –")).toBe(false);
  });
});
