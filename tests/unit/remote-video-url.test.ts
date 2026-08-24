import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { extract, toJSON } from "../../src/index.js";

const VIMEO_URL = "https://player.vimeo.com/video/123";
const YOUTUBE_URL = "https://www.youtube.com/embed/dQw4w9WgXcQ";

function hoappWithRemoteVideos(content: string, videos: string): string {
  return `
const { SectionEditable, VideoEditable } = HoApp;
const iCourse = { title: \`Remote\`, code: \`R\`, language: \`pt\` };
${videos}
const sections = [];
sections.push(
	new SectionEditable(
		'tela_video',
		{
			position: 1,
			content: \`${content}\`,
			components: [],
		}
	)
);
`;
}

async function zipFromDataJs(dataJs: string): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("js/data.js", dataJs);
  zip.file("_telas/tela_video.html", "<p></p>");
  return zip.generateAsync({ type: "uint8array" });
}

describe("remote video URLs are preserved", () => {
  it("keeps Vimeo url, source and title with bytes null", async () => {
    const dataJs = hoappWithRemoteVideos(
      `<as-video id="vid1"></as-video>`,
      `const cvid = new VideoEditable('vid1', ${JSON.stringify({
        version: 2,
        videoType: "VIMEO",
        path: VIMEO_URL,
        title: "Vídeo Exemplo",
      })});`,
    ).replace("components: []", "components: [cvid]");

    const result = await extract(await zipFromDataJs(dataJs));
    const video = result.documents[0]?.videos[0];
    expect(video).toMatchObject({
      ref: "VIDEO_0",
      source: "vimeo",
      url: VIMEO_URL,
      title: "Vídeo Exemplo",
      bytes: null,
      originalPath: null,
      filename: null,
      mimeType: null,
    });
  });

  it("keeps YouTube url, source and title with bytes null", async () => {
    const dataJs = hoappWithRemoteVideos(
      `<as-video id="yt1"></as-video>`,
      `const cyt = new VideoEditable('yt1', ${JSON.stringify({
        version: 2,
        videoType: "YOUTUBE",
        path: YOUTUBE_URL,
        title: "Aula",
      })});`,
    ).replace("components: []", "components: [cyt]");

    const result = await extract(await zipFromDataJs(dataJs));
    const video = result.documents[0]?.videos[0];
    expect(video).toMatchObject({
      ref: "VIDEO_0",
      source: "youtube",
      url: YOUTUBE_URL,
      title: "Aula",
      bytes: null,
    });
  });

  it("keeps iframe YouTube src as url", async () => {
    const dataJs = hoappWithRemoteVideos(
      `<iframe src="${YOUTUBE_URL}"></iframe>`,
      "",
    );
    const result = await extract(await zipFromDataJs(dataJs));
    const video = result.documents[0]?.videos[0];
    expect(video?.source).toBe("youtube");
    expect(video?.url).toBe(YOUTUBE_URL);
    expect(video?.bytes).toBeNull();
  });

  it("does not drop remote url when includeBytes.videos is false", async () => {
    const dataJs = hoappWithRemoteVideos(
      `<as-video id="vid1"></as-video>`,
      `const cvid = new VideoEditable('vid1', ${JSON.stringify({
        version: 2,
        videoType: "VIMEO",
        path: VIMEO_URL,
        title: "Intro",
      })});`,
    ).replace("components: []", "components: [cvid]");

    const result = await extract(await zipFromDataJs(dataJs), {
      includeBytes: { images: false, pdfs: false, videos: false },
    });
    const video = result.documents[0]?.videos[0];
    expect(video?.url).toBe(VIMEO_URL);
    expect(video?.source).toBe("vimeo");
    expect(video?.title).toBe("Intro");
    expect(video?.bytes).toBeNull();
  });

  it("does not drop remote url when includeBytes.videos is true", async () => {
    const dataJs = hoappWithRemoteVideos(
      `<as-video id="vid1"></as-video>`,
      `const cvid = new VideoEditable('vid1', ${JSON.stringify({
        version: 2,
        videoType: "VIMEO",
        path: VIMEO_URL,
        title: "Intro",
      })});`,
    ).replace("components: []", "components: [cvid]");

    const result = await extract(await zipFromDataJs(dataJs), {
      includeBytes: { videos: true },
    });
    const video = result.documents[0]?.videos[0];
    expect(video?.url).toBe(VIMEO_URL);
    expect(video?.bytes).toBeNull();
  });

  it("toJSON copies url, source and title (including omitBytes: true)", async () => {
    const dataJs = hoappWithRemoteVideos(
      `<as-video id="vid1"></as-video><iframe src="${YOUTUBE_URL}"></iframe>`,
      `const cvid = new VideoEditable('vid1', ${JSON.stringify({
        version: 2,
        videoType: "VIMEO",
        path: VIMEO_URL,
        title: "Vídeo Exemplo",
      })});`,
    ).replace("components: []", "components: [cvid]");

    const result = await extract(await zipFromDataJs(dataJs));
    const full = toJSON(result);
    const slim = toJSON(result, { omitBytes: true });
    const parsed = JSON.parse(JSON.stringify(full)) as typeof full;

    for (const payload of [full, slim, parsed]) {
      const vimeo = payload.documents[0]?.videos.find((v) => v.source === "vimeo");
      const youtube = payload.documents[0]?.videos.find((v) => v.source === "youtube");
      expect(vimeo?.url).toBe(VIMEO_URL);
      expect(vimeo?.title).toBe("Vídeo Exemplo");
      expect(vimeo?.bytes).toBeNull();
      expect(youtube?.url).toBe(YOUTUBE_URL);
      expect(youtube?.bytes).toBeNull();
    }
  });
});
