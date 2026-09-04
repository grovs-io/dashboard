export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public data?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const USER_FRIENDLY_MESSAGES: Record<number, string> = {
  400: "Invalid request. Please check your input.",
  403: "You don't have permission to perform this action.",
  404: "The requested resource was not found.",
  409: "This action conflicts with the current state.",
  422: "The provided data is invalid.",
  429: "Too many requests. Please try again later.",
};

export function getErrorMessage(status: number): string {
  if (status >= 500) return "Server error. Please try again later.";
  return USER_FRIENDLY_MESSAGES[status] ?? "An unexpected error occurred.";
}

export interface ApiErrorInfo {
  /** A human-friendly top-level message, safe to show in a toast/banner. */
  message: string;
  /** Field-specific messages keyed by backend field name (e.g. `email`). */
  fieldErrors: Record<string, string>;
}

const humanizeField = (field: string): string => {
  const spaced = field.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

// Pulls the raw response body out of whichever error shape we received. Requests
// that go through `lib/api.ts` throw an `ApiError` (body on `.data`); calls made
// with plain axios (e.g. the BFF auth routes) throw an `AxiosError`. The body may
// be a JSON object, a bare string, or absent — callers decide how to read it.
const getRawErrorData = (error: unknown): unknown =>
  error instanceof ApiError
    ? error.data
    : isAxiosLike(error)
      ? error.response?.data
      : undefined;

// The HTTP status lets us decide how much to trust the body: 5xx bodies may
// leak server internals, so we never surface their text (see `getApiErrorInfo`).
const getErrorStatus = (error: unknown): number | undefined =>
  error instanceof ApiError
    ? error.status
    : isAxiosLike(error)
      ? error.response?.status
      : undefined;

const isAxiosLike = (
  error: unknown
): error is { response?: { data?: unknown; status?: number } } =>
  typeof error === "object" &&
  error !== null &&
  "response" in error &&
  "isAxiosError" in error;

// OAuth 2.0 (and similar) return machine-readable codes like `invalid_grant`,
// not user copy. Map the ones we expect to friendly text.
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_grant: "The email or password you entered is incorrect.",
  invalid_client: "We couldn't verify this app. Please try again.",
  unauthorized_client: "This account isn't allowed to sign in this way.",
  unsupported_grant_type: "Something went wrong. Please try again.",
  invalid_scope: "Something went wrong. Please try again.",
  invalid_request: "The request was invalid. Please try again.",
  access_denied: "Access was denied.",
};

/** The 403 body every password-based auth endpoint returns on an SSO-enforced domain. */
export interface SsoRefusal {
  error: string;
  sso_connection_id: number;
}

export const getSsoRefusal = (error: unknown): SsoRefusal | null => {
  if (getErrorStatus(error) !== 403) return null;
  const body = getRawErrorData(error);
  if (!body || typeof body !== "object") return null;
  const { error: text, sso_connection_id: id } = body as Record<
    string,
    unknown
  >;
  return typeof id === "number" && typeof text === "string"
    ? { error: text, sso_connection_id: id }
    : null;
};

// A bare `lower_snake_case` token with no spaces reads as a code, not a message.
const looksLikeMachineCode = (text: string): boolean =>
  /^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(text);

// Turns a raw `error`/body value into user-facing copy: known codes map to
// friendly text, unknown codes are dropped (so we fall back to safe generic
// copy instead of showing e.g. `invalid_grant`), and real sentences pass through.
const resolveErrorText = (text: string): string => {
  if (!text) return "";
  if (OAUTH_ERROR_MESSAGES[text]) return OAUTH_ERROR_MESSAGES[text];
  return looksLikeMachineCode(text) ? "" : text;
};

const asText = (value: unknown): string =>
  Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string").join(", ")
    : typeof value === "string"
      ? value
      : "";

/**
 * Normalises the many error shapes a backend might return into a single
 * top-level `message` plus a map of `fieldErrors`. Handles OAuth-style
 * (`error` / `error_description`), Rails validation (`errors: { field: [...] }`),
 * and plain `{ message }` bodies, always falling back to a sensible default.
 */
export function getApiErrorInfo(
  error: unknown,
  fallback = "Something went wrong, please try again"
): ApiErrorInfo {
  const status = getErrorStatus(error);
  const rawData = getRawErrorData(error);
  const fieldErrors: Record<string, string> = {};

  // Server errors (5xx) may carry exception details/stack traces in the body.
  // Never surface that text — show safe generic copy (the caller's fallback).
  const isServerError = status !== undefined && status >= 500;
  if (isServerError) {
    return { message: fallback, fieldErrors };
  }

  // Some endpoints (or proxies) return a bare string body instead of JSON.
  if (typeof rawData === "string") {
    return {
      message: resolveErrorText(asText(rawData)) || fallback,
      fieldErrors,
    };
  }

  const body =
    rawData && typeof rawData === "object"
      ? (rawData as Record<string, unknown>)
      : undefined;
  let message = "";

  if (body) {
    // Rails validation errors: { errors: { email: ["has already been taken"] } }
    const errors = body.errors;
    if (errors && typeof errors === "object" && !Array.isArray(errors)) {
      for (const [field, value] of Object.entries(
        errors as Record<string, unknown>
      )) {
        const text = asText(value);
        if (text) fieldErrors[field] = `${humanizeField(field)} ${text}`;
      }
    }

    message =
      asText(body.error_description) ||
      // `error` can be a machine code (e.g. "invalid_grant") or a full sentence;
      // `resolveErrorText` maps known codes and drops unrecognised ones.
      resolveErrorText(asText(body.error)) ||
      asText(body.message) ||
      asText(errors) ||
      "";
  }

  // Prefer a field-specific message when the body only carried validation errors.
  if (!message) {
    const firstField = Object.values(fieldErrors)[0];
    message = firstField || (error instanceof ApiError ? error.message : "");
  }

  return { message: message || fallback, fieldErrors };
}
