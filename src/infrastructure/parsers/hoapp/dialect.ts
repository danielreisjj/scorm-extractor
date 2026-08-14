export type HoappDialect = "a" | "b";

export function detectHoappDialect(dataJs: string): HoappDialect {
  if (/new\s+SectionEditable\s*\(/.test(dataJs)) return "a";
  return "b";
}
