/**
 * Stable warning codes. `result.warnings` stays `string[]`; each coded
 * warning is `"${code}: ${message}"` so consumers can match with
 * `warning.startsWith(WarningCode.…)`.
 */
export const WarningCode = {
  UNSUPPORTED_QUIZ_TYPE: "unsupported_quiz_type",
  QUIZ_MISSING_ANSWER_KEY: "quiz_missing_answer_key",
} as const;

export type WarningCodeValue = (typeof WarningCode)[keyof typeof WarningCode];

export function formatWarning(code: WarningCodeValue, message: string): string {
  return `${code}: ${message}`;
}
