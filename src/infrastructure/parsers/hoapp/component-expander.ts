import * as cheerio from "cheerio";
import {
  asArray,
  asRecord,
  asString,
  type HoappComponent,
  type HoappComponentType,
} from "./ir.js";

const TAG_TO_TYPE: Record<string, HoappComponentType> = {
  "as-menu-item": "menu-item",
  "as-video": "video",
  "as-modal": "modal",
  "as-accordion": "accordion",
  "as-slider": "slider",
  "as-image-map": "image-map",
  "as-flipcard": "flipcard",
  "as-abas": "tabs",
  "as-trava-via-click": "lock",
  "as-assessment": "assessment",
  "as-question": "question",
};

export function expandComponents(
  html: string,
  components: Map<string, HoappComponent>,
): string {
  const $ = cheerio.load(html);

  $("as-header").remove();
  $("template").each((_, el) => {
    $(el).replaceWith($(el).html() ?? "");
  });

  $("as-menu-item").remove();

  $("as-trava-via-click").each((_, el) => {
    $(el).replaceWith($(el).html() ?? "");
  });

  for (const [tag, type] of Object.entries(TAG_TO_TYPE)) {
    if (type === "menu-item" || type === "lock") continue;
    $(tag).each((_, el) => {
      const id = $(el).attr("id") ?? "";
      const component = components.get(id) ?? { id, type, data: {} };
      const inner = $(el).html() ?? "";
      $(el).replaceWith(expandComponent(component, inner));
    });
  }

  return $("body").html() ?? "";
}

function expandComponent(component: HoappComponent, innerHtml: string): string {
  switch (component.type) {
    case "video":
      return `<span data-extract-video="${escapeAttr(component.id)}"></span>`;
    case "accordion":
    case "slider":
    case "tabs":
      return expandItems(component.data, "h3");
    case "flipcard":
      return expandFlipcard(component.data);
    case "image-map":
      return expandImageMap(component.data);
    case "modal":
      return expandModal(component.data, innerHtml);
    case "assessment":
      return expandAssessment(component.data, innerHtml);
    case "question":
      return expandQuestion(component.data, innerHtml);
    default:
      return innerHtml;
  }
}

function expandItems(data: Record<string, unknown>, heading: string): string {
  const items = asArray(data.items);
  return items
    .map((item) => {
      const rec = asRecord(item);
      const title = stringifyTitle(rec.title);
      const content = asString(rec.content);
      return `<div class="extract-item"><${heading}>${title}</${heading}>${content}</div>`;
    })
    .join("");
}

function expandFlipcard(data: Record<string, unknown>): string {
  const image = asString(data.image);
  const alt = asString(data.imageAlt);
  const title = stringifyTitle(data.title);
  const content = asString(data.content);
  const img = image
    ? `<img src="${escapeAttr(image)}" alt="${escapeAttr(alt)}">`
    : "";
  return `<div class="extract-flipcard">${img}<h3>${title}</h3>${content}</div>`;
}

function expandImageMap(data: Record<string, unknown>): string {
  const image = asString(data.image);
  const alt = asString(data.imageAlt);
  const img = image
    ? `<img src="${escapeAttr(image)}" alt="${escapeAttr(alt)}">`
    : "";
  const items = asArray(data.items)
    .map((item) => {
      const rec = asRecord(item);
      const title = stringifyTitle(rec.title);
      const content = asString(rec.content);
      return `<div class="extract-hotspot"><h3>${title}</h3>${content}</div>`;
    })
    .join("");
  return `<div class="extract-image-map">${img}${items}</div>`;
}

function expandModal(data: Record<string, unknown>, innerHtml: string): string {
  const title = stringifyTitle(data.title);
  const content = asString(data.content);
  const heading = title ? `<h3>${title}</h3>` : "";
  return `<div class="extract-modal">${innerHtml}${heading}${content}</div>`;
}

function expandAssessment(
  data: Record<string, unknown>,
  innerHtml: string,
): string {
  const title = stringifyTitle(data.title || data.label);
  const questions = asArray(data.questions ?? data.items);
  const heading = title ? `<h2>${title}</h2>` : "";
  const body =
    questions.length > 0
      ? questions.map((q) => expandQuestion(asRecord(q), "")).join("")
      : expandQuestion(data, innerHtml);
  return `<div class="extract-assessment">${heading}${body}</div>`;
}

function expandQuestion(
  data: Record<string, unknown>,
  innerHtml: string,
): string {
  const prompt =
    asString(data.question) ||
    asString(data.prompt) ||
    asString(data.title) ||
    asString(data.label) ||
    asString(data.content);
  const choices = collectChoices(data);
  const choiceHtml = choices
    .map((choice) => {
      const mark = choice.correct ? " (correct)" : "";
      return `<li>${escapeHtml(choice.text)}${mark}</li>`;
    })
    .join("");
  const list = choiceHtml ? `<ul>${choiceHtml}</ul>` : "";
  const promptBlock = prompt ? `<p>${prompt}</p>` : "";
  return `<div class="extract-question">${innerHtml}${promptBlock}${list}</div>`;
}

function collectChoices(
  data: Record<string, unknown>,
): Array<{ text: string; correct: boolean }> {
  const raw = asArray(
    data.choices ?? data.answers ?? data.options ?? data.items,
  );
  return raw
    .map((item) => {
      if (typeof item === "string") {
        return { text: item, correct: false };
      }
      const rec = asRecord(item);
      const text =
        asString(rec.text) ||
        asString(rec.label) ||
        asString(rec.content) ||
        asString(rec.title) ||
        stringifyTitle(rec.value);
      const status = asString(rec.status).toLowerCase();
      const correct =
        rec.correct === true ||
        status === "correct" ||
        asString(rec.evaluate) === "correct";
      return { text, correct };
    })
    .filter((choice) => choice.text.length > 0);
}

function stringifyTitle(value: unknown): string {
  if (typeof value === "number") return String(value);
  return asString(value);
}

function escapeAttr(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
