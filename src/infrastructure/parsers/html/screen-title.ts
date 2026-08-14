import * as cheerio from "cheerio";
import { isPlausibleTitle, normalizeTitleText } from "./text-normalizer.js";

const DEFAULT_HEADING_SELECTORS = "h1, h2, h3, h4";

/**
 * First heading that looks like a screen title (short, not a paragraph).
 * Parsers pass extra selectors when the format has its own title class.
 */
export function firstPlausibleHeading(
  html: string,
  selectors = DEFAULT_HEADING_SELECTORS,
): string {
  const $ = cheerio.load(html);
  for (const el of $(selectors).toArray()) {
    const text = normalizeTitleText($(el).text());
    if (isPlausibleTitle(text)) return text;
  }
  return "";
}
