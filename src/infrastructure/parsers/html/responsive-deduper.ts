import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import { normalizeComparableText } from "./text-normalizer.js";

const RESPONSIVE_CLASSES = ["desktop-only", "tablet-only", "mobile-only"] as const;
const PREFERENCE = ["desktop-only", "tablet-only", "mobile-only"] as const;

export function dedupeResponsiveHtml(html: string): string {
  const $ = cheerio.load(html);
  const nodes = $("[class]").toArray().filter((el) => {
    const cls = $(el).attr("class") ?? "";
    return RESPONSIVE_CLASSES.some((name) => hasClass(cls, name));
  });

  const groups = new Map<string, typeof nodes>();
  for (const el of nodes) {
    const text = normalizeComparableText($(el).text());
    if (!text) continue;
    const group = groups.get(text) ?? [];
    group.push(el);
    groups.set(text, group);
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const keeper = pickPreferred($, group);
    for (const el of group) {
      if (el !== keeper) {
        $(el).remove();
      }
    }
  }

  return $("body").html() ?? $.root().html() ?? "";
}

function pickPreferred($: cheerio.CheerioAPI, group: Element[]): Element {
  for (const preferred of PREFERENCE) {
    const match = group.find((el) => hasClass($(el).attr("class") ?? "", preferred));
    if (match) return match;
  }
  const first = group[0];
  if (!first) {
    throw new Error("empty responsive group");
  }
  return first;
}

function hasClass(className: string, token: string): boolean {
  return className.split(/\s+/).includes(token);
}
