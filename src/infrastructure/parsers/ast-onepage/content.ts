import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import { InvalidPackageError } from "../../../domain/errors.js";
import type { Course } from "../../../domain/models.js";
import type { PackageReader } from "../../../domain/ports.js";
import { normalizeAssetPath } from "../../asset-loader.js";

const SECTION_ID = /^c\d+$/i;
const MODULE_HTML = /(?:^|\/)resources\/m\d+\/index\.html$/i;
const REDIRECT =
  /window\.location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/i;

export type AstScreen = {
  id: string;
  position: number;
  html: string;
};

export async function readContentHtml(
  reader: PackageReader,
): Promise<{ path: string; html: string }> {
  const redirected = await followRootRedirect(reader);
  if (redirected && reader.has(redirected)) {
    return { path: redirected, html: await reader.readText(redirected) };
  }

  const modules = reader
    .list()
    .filter((name) => MODULE_HTML.test(name) && !name.includes("/_bkp/"))
    .sort(compareModulePaths);
  const path = modules[0];
  if (!path) {
    throw new InvalidPackageError(
      "AST OnePage package is missing resources/mN/index.html",
    );
  }
  return { path, html: await reader.readText(path) };
}

export function splitScreens(html: string): AstScreen[] {
  const $ = cheerio.load(html);
  const numbered = $("div[id]")
    .toArray()
    .filter((el) => SECTION_ID.test($(el).attr("id") ?? ""));

  const elements =
    numbered.length > 0
      ? numbered.sort(
          (a, b) => sectionNumber($(a).attr("id")) - sectionNumber($(b).attr("id")),
        )
      : fallbackContainers($);

  return elements.map((el, index) => {
    const idAttr = $(el).attr("id");
    const id =
      idAttr && SECTION_ID.test(idAttr) ? idAttr.toLowerCase() : `c${index + 1}`;
    return {
      id,
      position: index + 1,
      html: materializePopupImages($(el).html() ?? ""),
    };
  });
}

export async function readCourseMeta(
  reader: PackageReader,
  contentHtml: string,
  rootHtml: string,
): Promise<Course> {
  const manifest = reader.has("imsmanifest.xml")
    ? await reader.readText("imsmanifest.xml")
    : "";
  const title =
    htmlTitle(contentHtml) || htmlTitle(rootHtml) || manifestTitle(manifest);
  const language = htmlLang(contentHtml) || htmlLang(rootHtml) || "pt";
  return {
    title,
    code: manifestCode(manifest),
    language,
  };
}

export async function readRootHtml(reader: PackageReader): Promise<string> {
  if (!reader.has("index.html")) return "";
  return reader.readText("index.html");
}

async function followRootRedirect(reader: PackageReader): Promise<string | null> {
  if (!reader.has("index.html")) return null;
  const index = await reader.readText("index.html");
  const match = REDIRECT.exec(index);
  if (!match?.[1]) return null;
  return normalizeAssetPath(match[1]);
}

function fallbackContainers($: cheerio.CheerioAPI): Element[] {
  return $("div.container")
    .toArray()
    .filter((el) => {
      const node = $(el);
      return (
        node.parents("div.container").length === 0 &&
        node.parents("nav").length === 0 &&
        node.parents(".popup").length === 0
      );
    });
}

function materializePopupImages(html: string): string {
  const $ = cheerio.load(html);
  $("[onclick], [data-href]").each((_, el) => {
    const haystack = `${$(el).attr("onclick") ?? ""} ${$(el).attr("data-href") ?? ""}`;
    for (const match of haystack.matchAll(
      /([^"'\\\s)]+\.(?:png|jpe?g|gif|webp))/gi,
    )) {
      const src = match[1];
      if (src) $(el).append(`<img src="${src}">`);
    }
  });
  return $("body").html() ?? html;
}

function sectionNumber(id: string | undefined): number {
  const match = /^c(\d+)$/i.exec(id ?? "");
  return match?.[1] ? Number(match[1]) : 0;
}

function compareModulePaths(a: string, b: string): number {
  const num = (path: string) => {
    const match = /resources\/m(\d+)\//i.exec(path);
    return match?.[1] ? Number(match[1]) : 0;
  };
  return num(a) - num(b) || a.localeCompare(b);
}

function htmlTitle(html: string): string {
  const match = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
  return (match?.[1] ?? "").replace(/\s+/g, " ").trim();
}

function htmlLang(html: string): string {
  const match = /<html\b[^>]*\blang=["']([^"']+)["']/i.exec(html);
  return (match?.[1] ?? "").trim();
}

function manifestTitle(xml: string): string {
  const org = /<organization\b[^>]*>\s*<title[^>]*>([^<]*)<\/title>/i.exec(xml);
  return (org?.[1] ?? "").replace(/\s+/g, " ").trim();
}

function manifestCode(xml: string): string {
  const match = /<organization\b[^>]*\bidentifier=["']([^"']+)["']/i.exec(xml);
  const code = (match?.[1] ?? "").trim();
  if (!code || code === "course-code-here" || code === "CourseIDNum") return "";
  return code;
}
