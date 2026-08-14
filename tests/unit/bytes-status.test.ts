import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { extract, fromJSON, toJSON } from "../../src/index.js";
import { MINI_HOAPP_DATA_JS, TINY_PNG } from "../fixtures/mini-hoapp.js";

const LOCAL_VIDEO_DATA_JS = `
const { SectionEditable, VideoEditable } = HoApp;
const iCourse = { title: \`Local\`, code: \`L\`, language: \`pt\` };
const cvid = new VideoEditable(
	'vid1',
	{"version":2,"videoType":"FILE","path":"midias/videos/aula.mp4","title":"Aula"},
);
const sections = [];
sections.push(
	new SectionEditable(
		'tela_01',
		{
			position: 1,
			content: \`<p>Watch</p><as-video id="vid1"></as-video>\`,
			components: [cvid],
		}
	)
);
`;

async function zipWith(files: Record<string, string | Uint8Array>): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content);
  }
  return zip.generateAsync({ type: "uint8array" });
}

describe("bytesStatus", () => {
  it("is present when bytes were loaded", async () => {
    const result = await extract(
      await zipWith({
        "js/data.js": MINI_HOAPP_DATA_JS,
        "midias/imagens/foto.png": TINY_PNG,
        "midias/docs/a.pdf": "%PDF-1.4 mini",
        "_telas/tela_01.html": "<p></p>",
      }),
    );
    expect(result.documents[0]?.images[0]?.bytesStatus).toBe("present");
    expect(result.documents[0]?.images[0]?.bytes).toBeInstanceOf(Uint8Array);
    expect(result.documents[0]?.pdfs[0]?.bytesStatus).toBe("present");
    expect(result.documents[0]?.pdfs[0]?.bytes).toBeInstanceOf(Uint8Array);
  });

  it("is omitted when includeBytes is false but the file exists", async () => {
    const result = await extract(
      await zipWith({
        "js/data.js": MINI_HOAPP_DATA_JS,
        "midias/imagens/foto.png": TINY_PNG,
        "midias/docs/a.pdf": "%PDF-1.4 mini",
        "_telas/tela_01.html": "<p></p>",
      }),
      { includeBytes: { images: false, pdfs: false, videos: false } },
    );
    expect(result.documents[0]?.images[0]?.bytesStatus).toBe("omitted");
    expect(result.documents[0]?.images[0]?.bytes).toBeNull();
    expect(result.documents[0]?.pdfs[0]?.bytesStatus).toBe("omitted");
    expect(result.documents[0]?.pdfs[0]?.bytes).toBeNull();
    expect(result.warnings.some((w) => w.startsWith("Missing"))).toBe(false);
  });

  it("is missing when the file is absent from the ZIP (warning still emitted)", async () => {
    const result = await extract(
      await zipWith({
        "js/data.js": MINI_HOAPP_DATA_JS,
        "_telas/tela_01.html": "<p></p>",
      }),
    );
    expect(result.documents[0]?.images[0]?.bytesStatus).toBe("missing");
    expect(result.documents[0]?.images[0]?.bytes).toBeNull();
    expect(result.documents[0]?.pdfs[0]?.bytesStatus).toBe("missing");
    expect(result.warnings.some((w) => w.includes("Missing image"))).toBe(true);
    expect(result.warnings.some((w) => w.includes("Missing PDF"))).toBe(true);
  });

  it("is remote for Vimeo/YouTube regardless of includeBytes.videos", async () => {
    const result = await extract(
      await zipWith({
        "js/data.js": MINI_HOAPP_DATA_JS,
        "midias/imagens/foto.png": TINY_PNG,
        "_telas/tela_01.html": "<p></p>",
      }),
      { includeBytes: { videos: true } },
    );
    const video = result.documents[0]?.videos[0];
    expect(video?.bytesStatus).toBe("remote");
    expect(video?.bytes).toBeNull();
    expect(video?.mimeType).toBeNull();
    expect(video?.url).toBe("https://player.vimeo.com/video/1");
  });

  it("is present/omitted/missing for local video", async () => {
    const withFile = await extract(
      await zipWith({
        "js/data.js": LOCAL_VIDEO_DATA_JS,
        "midias/videos/aula.mp4": "fake-mp4",
        "_telas/tela_01.html": "<p></p>",
      }),
      { includeBytes: { videos: true } },
    );
    expect(withFile.documents[0]?.videos[0]?.bytesStatus).toBe("present");
    expect(withFile.documents[0]?.videos[0]?.bytes).toBeInstanceOf(Uint8Array);
    expect(withFile.documents[0]?.videos[0]?.mimeType).toBe("video/mp4");

    const omitted = await extract(
      await zipWith({
        "js/data.js": LOCAL_VIDEO_DATA_JS,
        "midias/videos/aula.mp4": "fake-mp4",
        "_telas/tela_01.html": "<p></p>",
      }),
      { includeBytes: { videos: false } },
    );
    expect(omitted.documents[0]?.videos[0]?.bytesStatus).toBe("omitted");
    expect(omitted.documents[0]?.videos[0]?.bytes).toBeNull();
    expect(omitted.documents[0]?.videos[0]?.mimeType).toBe("video/mp4");

    const missing = await extract(
      await zipWith({
        "js/data.js": LOCAL_VIDEO_DATA_JS,
        "_telas/tela_01.html": "<p></p>",
      }),
      { includeBytes: { videos: true } },
    );
    expect(missing.documents[0]?.videos[0]?.bytesStatus).toBe("missing");
    expect(missing.warnings.some((w) => w.includes("Missing video"))).toBe(true);
  });

  it("survives toJSON/fromJSON; omitBytes nulls bytes but keeps status", async () => {
    const result = await extract(
      await zipWith({
        "js/data.js": MINI_HOAPP_DATA_JS,
        "midias/imagens/foto.png": TINY_PNG,
        "midias/docs/a.pdf": "%PDF-1.4 mini",
        "_telas/tela_01.html": "<p></p>",
      }),
    );
    const restored = fromJSON(toJSON(result, { omitBytes: true }));
    expect(restored.documents[0]?.images[0]?.bytes).toBeNull();
    expect(restored.documents[0]?.images[0]?.bytesStatus).toBe("present");
    expect(restored.documents[0]?.videos[0]?.bytesStatus).toBe("remote");
    expect(restored.documents[0]?.videos[0]?.url).toBe(
      "https://player.vimeo.com/video/1",
    );
  });
});
