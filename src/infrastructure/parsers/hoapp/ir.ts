export type HoappComponentType =
  | "menu-item"
  | "video"
  | "modal"
  | "accordion"
  | "slider"
  | "image-map"
  | "flipcard"
  | "tabs"
  | "lock"
  | "assessment"
  | "question"
  | "unknown";

export interface HoappComponent {
  id: string;
  type: HoappComponentType;
  data: Record<string, unknown>;
}

export interface HoappSection {
  id: string;
  position: number;
  content: string;
}

export interface HoappCourseMeta {
  title: string;
  code: string;
  language: string;
}

export interface HoappIR {
  course: HoappCourseMeta;
  components: Map<string, HoappComponent>;
  sections: HoappSection[];
}

const TYPE_BY_CONSTRUCTOR: Record<string, HoappComponentType> = {
  MenuItem: "menu-item",
  VideoEditable: "video",
  Modal: "modal",
  Accordion: "accordion",
  Slider: "slider",
  ImageMap: "image-map",
  FlipCard: "flipcard",
  TabsEditable: "tabs",
  LockByClick: "lock",
  Assessment: "assessment",
  Question: "question",
};

const TYPE_BY_AS: Record<string, HoappComponentType> = {
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

export function typeFromConstructor(name: string): HoappComponentType {
  return TYPE_BY_CONSTRUCTOR[name] ?? "unknown";
}

export function typeFromAsTag(type: string): HoappComponentType {
  return TYPE_BY_AS[type] ?? "unknown";
}

export function isQuizComponentType(type: HoappComponentType): boolean {
  return type === "assessment" || type === "question";
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
