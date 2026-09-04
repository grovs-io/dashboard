import { describe, it, expect } from "vitest";
import { ApiError, getApiErrorInfo, getErrorMessage } from "../ApiError";

describe("ApiError", () => {
  it("creates an error with message and status", () => {
    const error = new ApiError("Not found", 404);
    expect(error.message).toBe("Not found");
    expect(error.status).toBe(404);
    expect(error.name).toBe("ApiError");
  });

  it("is an instance of Error", () => {
    const error = new ApiError("Bad request", 400);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ApiError);
  });

  it("stores optional code and data", () => {
    const error = new ApiError("Conflict", 409, "DUPLICATE", {
      field: "email",
    });
    expect(error.code).toBe("DUPLICATE");
    expect(error.data).toEqual({ field: "email" });
  });

  it("has undefined code and data when not provided", () => {
    const error = new ApiError("Error", 500);
    expect(error.code).toBeUndefined();
    expect(error.data).toBeUndefined();
  });
});

describe("getErrorMessage", () => {
  it("returns mapped message for known status codes", () => {
    expect(getErrorMessage(400)).toContain("Invalid request");
    expect(getErrorMessage(403)).toContain("permission");
    expect(getErrorMessage(404)).toContain("not found");
    expect(getErrorMessage(409)).toContain("conflicts");
    expect(getErrorMessage(422)).toContain("invalid");
    expect(getErrorMessage(429)).toContain("Too many requests");
  });

  it("returns server error for 5xx status codes", () => {
    expect(getErrorMessage(500)).toContain("Server error");
    expect(getErrorMessage(502)).toContain("Server error");
    expect(getErrorMessage(503)).toContain("Server error");
  });

  it("returns default message for unknown status codes", () => {
    expect(getErrorMessage(418)).toContain("unexpected error");
  });
});

describe("getApiErrorInfo", () => {
  it("maps Rails-style field validation errors onto fields", () => {
    const error = new ApiError(
      "The provided data is invalid.",
      422,
      undefined,
      {
        errors: { email: ["has already been taken"] },
      }
    );

    const info = getApiErrorInfo(error);
    expect(info.fieldErrors.email).toBe("Email has already been taken");
    // Falls back to the field message when there is no top-level message.
    expect(info.message).toBe("Email has already been taken");
  });

  it("humanizes multi-word field names and joins multiple messages", () => {
    const error = new ApiError("invalid", 422, undefined, {
      errors: { password_confirm: ["is too short", "must match"] },
    });

    const info = getApiErrorInfo(error);
    expect(info.fieldErrors.password_confirm).toBe(
      "Password confirm is too short, must match"
    );
  });

  it("prefers OAuth-style error_description / error for the top-level message", () => {
    const error = new ApiError("Bad request", 400, undefined, {
      error: "invalid_grant",
      error_description: "The credentials are invalid",
    });

    const info = getApiErrorInfo(error);
    expect(info.message).toBe("The credentials are invalid");
    expect(info.fieldErrors).toEqual({});
  });

  it("reads the body from a plain axios error shape", () => {
    const axiosError = {
      isAxiosError: true,
      response: { data: { message: "Email already registered" } },
    };

    const info = getApiErrorInfo(axiosError);
    expect(info.message).toBe("Email already registered");
  });

  it("falls back to the provided default when no body is present", () => {
    const info = getApiErrorInfo(new Error("boom"), "Custom fallback");
    expect(info.message).toBe("Custom fallback");
    expect(info.fieldErrors).toEqual({});
  });

  it("never surfaces 5xx response bodies (may contain server internals)", () => {
    const error = new ApiError(
      "Server error. Please try again later.",
      500,
      undefined,
      {
        error: "internal_server_error",
        message: "NoMethodError: undefined method `foo' for nil:NilClass",
      }
    );

    const info = getApiErrorInfo(error, "We couldn't create your account.");
    expect(info.message).toBe("We couldn't create your account.");
    expect(info.fieldErrors).toEqual({});
  });

  it("suppresses body text for axios-shaped 5xx errors too", () => {
    const axiosError = {
      isAxiosError: true,
      response: {
        status: 502,
        data: { message: "upstream connect error: connection refused" },
      },
    };

    const info = getApiErrorInfo(axiosError, "Please try again later.");
    expect(info.message).toBe("Please try again later.");
  });

  it("maps a bare OAuth error code to friendly copy", () => {
    const error = new ApiError("Bad request", 400, undefined, {
      error: "invalid_grant",
    });

    const info = getApiErrorInfo(error);
    expect(info.message).not.toContain("invalid_grant");
    expect(info.message).toBe(
      "The email or password you entered is incorrect."
    );
  });

  it("never surfaces an unknown machine-code error value", () => {
    // Mirrors how `lib/api.ts` builds the error: message is the generic,
    // status-derived copy, and the raw body sits on `.data`.
    const error = new ApiError(getErrorMessage(400), 400, undefined, {
      error: "some_unmapped_code",
    });

    const info = getApiErrorInfo(error, "Fallback copy");
    expect(info.message).not.toContain("some_unmapped_code");
    // Falls through to the safe, generic status message rather than the raw code.
    expect(info.message).toBe(getErrorMessage(400));
  });

  it("still shows a full-sentence `error` value verbatim", () => {
    const error = new ApiError("Bad request", 400, undefined, {
      error: "This account has been locked",
    });

    const info = getApiErrorInfo(error);
    expect(info.message).toBe("This account has been locked");
  });

  it("surfaces a plain-text (non-JSON) response body", () => {
    const error = new ApiError(
      "Conflict",
      409,
      undefined,
      "Email has already been registered"
    );

    const info = getApiErrorInfo(error);
    expect(info.message).toBe("Email has already been registered");
  });
});
