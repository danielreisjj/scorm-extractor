export function normalizeExtractedText(raw: string): string {
  const lines = raw
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => !isDecorativeLine(line));

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function normalizeComparableText(raw: string): string {
  return normalizeExtractedText(raw)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

export function normalizeTitleText(raw: string): string {
  return raw.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

/** Visual separators (dashes, bullets, ellipsis) — not course copy. */
export function isDecorativeLine(line: string): boolean {
  return /^[\s\-–—−•·∙._]+$/.test(line);
}

export function isPlausibleTitle(text: string): boolean {
  const value = normalizeTitleText(text);
  if (value.length < 2 || value.length > 80) return false;
  if (isDecorativeLine(value)) return false;
  if (value.split(/\s+/).length > 14) return false;
  return true;
}
