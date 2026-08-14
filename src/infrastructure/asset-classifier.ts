export type AssetRole = "content" | "chrome";

const FONT_EXT = /\.(?:woff2?|ttf|otf|eot)$/i;
const CHROME_NAME =
  /(?:^|\/)(?:logo|marca|favicon|sprite|vazio|spacer|blank|pixel)(?:[-_.]|$)/i;

export function classifyAsset(
  path: string,
  context: { className?: string } = {},
): AssetRole {
  const normalized = path.replace(/\\/g, "/").toLowerCase();

  if (normalized.includes("midias/interface/")) return "chrome";
  if (normalized.includes("midias/bg/")) return "chrome";
  if (normalized.includes("/fonts/") || FONT_EXT.test(normalized)) return "chrome";
  if (CHROME_NAME.test(normalized)) return "chrome";
  if ((context.className ?? "").split(/\s+/).includes("img-logo")) return "chrome";

  return "content";
}

export function mimeFromPath(path: string): string {
  const ext = extensionOf(path);
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    case "pdf":
      return "application/pdf";
    case "mp4":
      return "video/mp4";
    default:
      return "application/octet-stream";
  }
}

export function extensionOf(path: string): string {
  const base = path.split("?")[0] ?? path;
  const dot = base.lastIndexOf(".");
  if (dot < 0) return "";
  return base.slice(dot + 1).toLowerCase();
}
