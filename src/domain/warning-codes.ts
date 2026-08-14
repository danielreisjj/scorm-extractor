/**
 * Stable warning codes. `result.warnings` stays `string[]`; each coded
 * warning is `"${code}: ${message}"` so consumers can match with
 * `warning.startsWith(WarningCode.…)`.
 * @since 0.3.0
 */
export const WarningCode = {
  UNSUPPORTED_QUIZ_TYPE: "unsupported_quiz_type",
  QUIZ_MISSING_ANSWER_KEY: "quiz_missing_answer_key",
} as const;

/** @since 0.3.0 */
export type WarningCodeValue = (typeof WarningCode)[keyof typeof WarningCode];

/** @since 0.3.0 */
export function formatWarning(code: WarningCodeValue, message: string): string {
  return `${code}: ${message}`;
}
