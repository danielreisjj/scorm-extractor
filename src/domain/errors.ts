export const ErrorCode = {
  INVALID_INPUT: "INVALID_INPUT",
  IO_FAILURE: "IO_FAILURE",
  INVALID_PACKAGE: "INVALID_PACKAGE",
  PACKAGE_TOO_LARGE: "PACKAGE_TOO_LARGE",
  UNSAFE_ZIP_PATH: "UNSAFE_ZIP_PATH",
  UNSUPPORTED_PACKAGE_FORMAT: "UNSUPPORTED_PACKAGE_FORMAT",
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

export type DetectedUnsupportedFormat =
  | "storyline"
  | "rise"
  | "captivate"
  | "unknown";

export class ScormExtractorError extends Error {
  readonly code: ErrorCodeValue;
  override readonly cause?: unknown;

  constructor(
    code: ErrorCodeValue,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message);
    this.name = "ScormExtractorError";
    this.code = code;
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
    Object.setPrototypeOf(this, new.target.prototype);
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, new.target);
    }
  }
}

export class InvalidInputError extends ScormExtractorError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(ErrorCode.INVALID_INPUT, message, options);
    this.name = "InvalidInputError";
  }
}

export class IoError extends ScormExtractorError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(ErrorCode.IO_FAILURE, message, options);
    this.name = "IoError";
  }
}

export class InvalidPackageError extends ScormExtractorError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(ErrorCode.INVALID_PACKAGE, message, options);
    this.name = "InvalidPackageError";
  }
}

export class PackageTooLargeError extends ScormExtractorError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(ErrorCode.PACKAGE_TOO_LARGE, message, options);
    this.name = "PackageTooLargeError";
  }
}

export class UnsafeZipPathError extends ScormExtractorError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(ErrorCode.UNSAFE_ZIP_PATH, message, options);
    this.name = "UnsafeZipPathError";
  }
}

export class UnsupportedPackageFormatError extends ScormExtractorError {
  readonly detectedFormat: DetectedUnsupportedFormat;

  constructor(
    message: string,
    options?: { cause?: unknown; detectedFormat?: DetectedUnsupportedFormat },
  ) {
    super(ErrorCode.UNSUPPORTED_PACKAGE_FORMAT, message, options);
    this.name = "UnsupportedPackageFormatError";
    this.detectedFormat = options?.detectedFormat ?? "unknown";
  }
}

export function isScormExtractorError(
  err: unknown,
): err is ScormExtractorError {
  return err instanceof ScormExtractorError;
}
