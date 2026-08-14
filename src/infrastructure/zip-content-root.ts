const MANIFEST = "imsmanifest.xml";

/**
 * ZIP folder that actually holds the SCORM package.
 *
 * Some exports wrap the course in an envelope folder
 * (`Pacote/imsmanifest.xml` instead of `imsmanifest.xml` at the ZIP root).
 * Returns that folder (no trailing slash), or `""` when the package is
 * already rooted at the ZIP root / has no manifest to key off.
 */
export function findZipContentRoot(names: readonly string[]): string {
  const files = names.map(normalizeEntry);

  if (files.some((name) => name === MANIFEST)) {
    return "";
  }

  const manifestDirs = [
    ...new Set(
      files
        .filter((name) => name.endsWith(`/${MANIFEST}`))
        .map((name) => name.slice(0, -(MANIFEST.length + 1))),
    ),
  ];

  const firstLevel = manifestDirs.filter((dir) => dir.length > 0 && !dir.includes("/"));
  if (firstLevel.length === 1) {
    return firstLevel[0] ?? "";
  }
  if (firstLevel.length > 1) {
    const preferred = firstLevel.find((dir) =>
      files.some(
        (name) => name === `${dir}/index.html` || name === `${dir}/js/data.js`,
      ),
    );
    return preferred ?? firstLevel[0] ?? "";
  }

  if (manifestDirs.length === 1) {
    return manifestDirs[0] ?? "";
  }
  if (manifestDirs.length > 1) {
    const ranked = [...manifestDirs].sort(
      (a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b),
    );
    return ranked[0] ?? "";
  }

  return "";
}

function normalizeEntry(name: string): string {
  return name.replace(/\\/g, "/").replace(/^\.\//, "");
}
