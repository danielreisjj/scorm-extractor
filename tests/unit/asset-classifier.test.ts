import { describe, expect, it } from "vitest";
import { classifyAsset } from "../../src/infrastructure/asset-classifier.js";

describe("classifyAsset", () => {
  it("treats instructional bitmaps as content", () => {
    expect(classifyAsset("midias/imagens/tela_08_infografico.png")).toBe("content");
  });

  it("treats player chrome as chrome", () => {
    expect(classifyAsset("midias/interface/marca.svg")).toBe("chrome");
    expect(classifyAsset("midias/bg/fundo.jpg")).toBe("chrome");
    expect(classifyAsset("resources/interface/nav.png")).toBe("chrome");
    expect(classifyAsset("resources/m1/bg/bg_c1.jpg")).toBe("chrome");
    expect(classifyAsset("midias/imagens/vazio_300.png")).toBe("chrome");
    expect(classifyAsset("midias/imagens/logo_cob-cor.png")).toBe("chrome");
    expect(classifyAsset("css/fonts/icon.woff")).toBe("chrome");
    expect(classifyAsset("midias/imagens/fim.png", { className: "img-logo" })).toBe("chrome");
  });
});
