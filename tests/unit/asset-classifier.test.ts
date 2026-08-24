import { describe, expect, it } from "vitest";
import { classifyAsset } from "../../src/infrastructure/asset-classifier.js";

describe("classifyAsset", () => {
  it("treats instructional bitmaps as content", () => {
    expect(classifyAsset("midias/imagens/tela_01_diagrama.png")).toBe("content");
  });

  it("treats player chrome as chrome", () => {
    expect(classifyAsset("midias/interface/marca.svg")).toBe("chrome");
    expect(classifyAsset("midias/bg/fundo.jpg")).toBe("chrome");
    expect(classifyAsset("resources/interface/nav.png")).toBe("chrome");
    expect(classifyAsset("resources/m1/bg/fundo.jpg")).toBe("chrome");
    expect(classifyAsset("midias/imagens/vazio_01.png")).toBe("chrome");
    expect(classifyAsset("midias/imagens/logo.png")).toBe("chrome");
    expect(classifyAsset("css/fonts/icon.woff")).toBe("chrome");
    expect(classifyAsset("midias/imagens/tela.png", { className: "img-logo" })).toBe("chrome");
  });
});
