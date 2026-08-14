import { describe, expect, it } from "vitest";
import { linearizeHtml } from "../../src/infrastructure/parsers/html/html-linearizer.js";

describe("linearizeHtml", () => {
  it("turns p + img + p into an IMAGE marker and one image asset", () => {
    const html = `
      <p>Hello</p>
      <img src="midias/imagens/foto.png" alt="foto">
      <p>World</p>
    `;
    const result = linearizeHtml(html, { videosById: new Map() });
    expect(result.text).toContain("Hello");
    expect(result.text).toContain("[IMAGE_0]");
    expect(result.text).toContain("World");
    expect(result.images).toHaveLength(1);
    expect(result.images[0]).toMatchObject({
      ref: "IMAGE_0",
      originalPath: "midias/imagens/foto.png",
      filename: "foto.png",
      alt: "foto",
    });
    expect(result.images[0]).not.toHaveProperty("role");
  });

  it("inserts PDF and VIDEO markers that match array refs", () => {
    const html = `
      <p>Leia o material</p>
      <a onclick="window.open('midias/docs/atividade01.pdf')">Atividade</a>
      <span data-extract-video="vid1"></span>
    `;
    const result = linearizeHtml(html, {
      videosById: new Map([
        [
          "vid1",
          {
            videoType: "VIMEO",
            path: "https://player.vimeo.com/video/1",
            title: "Intro",
          },
        ],
      ]),
    });
    expect(result.text).toContain("[PDF_0]");
    expect(result.text).toContain("[VIDEO_0]");
    expect(result.pdfs[0]?.ref).toBe("PDF_0");
    expect(result.videos[0]).toMatchObject({
      ref: "VIDEO_0",
      source: "vimeo",
      url: "https://player.vimeo.com/video/1",
      mimeType: null,
    });
  });

  it("keeps button label and emits PDF from window.open", () => {
    const html = `
      <p>Clique para baixar as atividades.</p>
      <button onclick="window.open('midias/docs/x.pdf')" class="bt-download">Download</button>
    `;
    const result = linearizeHtml(html, { videosById: new Map() });
    expect(result.text).toContain("Clique para baixar as atividades.");
    expect(result.text).toContain("Download");
    expect(result.text).toContain("[PDF_0]");
    expect(result.pdfs[0]?.originalPath).toBe("midias/docs/x.pdf");
    expect(result.pdfs[0]?.filename).toBe("x.pdf");
  });

  it("keeps plain button UI copy (agnostic — no strip)", () => {
    const html = `<p>Capa</p><button class="bt-primario">Iniciar</button>`;
    const result = linearizeHtml(html, { videosById: new Map() });
    expect(result.text).toContain("Capa");
    expect(result.text).toContain("Iniciar");
  });

  it("skips chrome images", () => {
    const html = `<img class="img-logo" src="midias/imagens/logo_cob-cor.png"><img src="midias/interface/marca.svg">`;
    const result = linearizeHtml(html, { videosById: new Map() });
    expect(result.images).toEqual([]);
    expect(result.text).not.toContain("[IMAGE_0]");
  });

  it("emits a local VIDEO marker from a native video/source tag", () => {
    const html = `
      <p>Assista</p>
      <video>
        <source src="./videos/aula.mp4" type="video/mp4" />
      </video>
    `;
    const result = linearizeHtml(html, {
      videosById: new Map(),
      basePath: "resources/m1",
    });
    expect(result.text).toContain("[VIDEO_0]");
    expect(result.videos[0]).toMatchObject({
      ref: "VIDEO_0",
      source: "local",
      mimeType: "video/mp4",
      originalPath: "resources/m1/videos/aula.mp4",
    });
  });

  it("skips empty video sources used as popup templates", () => {
    const html = `<video><source src="" type="video/mp4" /></video>`;
    const result = linearizeHtml(html, { videosById: new Map() });
    expect(result.videos).toEqual([]);
    expect(result.text).not.toContain("[VIDEO_0]");
  });

  it("resolves relative image paths against basePath", () => {
    const html = `<img src="./images/foto.png" alt="foto">`;
    const result = linearizeHtml(html, {
      videosById: new Map(),
      basePath: "resources/m1",
    });
    expect(result.images[0]?.originalPath).toBe("resources/m1/images/foto.png");
  });

  it("trims whitespace in asset src paths", () => {
    const html = `<img src=" ./images/foto.png" alt="foto">`;
    const result = linearizeHtml(html, {
      videosById: new Map(),
      basePath: "resources/m1",
    });
    expect(result.images[0]?.originalPath).toBe("resources/m1/images/foto.png");
  });
});
