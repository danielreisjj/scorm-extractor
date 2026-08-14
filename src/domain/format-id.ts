export const HOAPP_FORMAT = "hoapp" as const;
export const AST_ONEPAGE_FORMAT = "ast-onepage" as const;

export type KnownFormatId = typeof HOAPP_FORMAT | typeof AST_ONEPAGE_FORMAT;

export type FormatId = string;
