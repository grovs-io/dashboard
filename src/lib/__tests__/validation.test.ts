import { describe, it, expect } from "vitest";
import {
  hasText,
  isValidHttpsUrl,
  isUrlSchemeValid,
  isRedirectUrlValid,
} from "@/lib/validation";

describe("hasText", () => {
  it("accepts a string with non-whitespace characters", () => {
    expect(hasText("grovs")).toBe(true);
    expect(hasText("  padded  ")).toBe(true);
  });

  it("rejects empty and whitespace-only strings", () => {
    expect(hasText("")).toBe(false);
    expect(hasText("   ")).toBe(false);
    expect(hasText("\n\t")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(hasText(undefined)).toBe(false);
    expect(hasText(null)).toBe(false);
    expect(hasText(0)).toBe(false);
    expect(hasText(42)).toBe(false);
    expect(hasText({})).toBe(false);
    expect(hasText(["a"])).toBe(false);
  });
});

describe("isValidHttpsUrl", () => {
  it("accepts https URLs", () => {
    expect(isValidHttpsUrl("https://grovs.io")).toBe(true);
    expect(isValidHttpsUrl("https://sub.grovs.io/path?q=1")).toBe(true);
  });

  it("rejects http URLs even though they are well formed", () => {
    expect(isValidHttpsUrl("http://grovs.io")).toBe(false);
  });

  it("rejects malformed URLs", () => {
    expect(isValidHttpsUrl("not a url")).toBe(false);
    expect(isValidHttpsUrl("https://")).toBe(false);
  });

  it("rejects empty, null and undefined", () => {
    expect(isValidHttpsUrl("")).toBe(false);
    expect(isValidHttpsUrl(null)).toBe(false);
    expect(isValidHttpsUrl(undefined)).toBe(false);
  });
});

describe("isUrlSchemeValid", () => {
  it("accepts custom app schemes", () => {
    expect(isUrlSchemeValid("myapp://")).toBe(true);
    expect(isUrlSchemeValid("grovs://open/link")).toBe(true);
  });

  it("rejects strings without the :// separator", () => {
    expect(isUrlSchemeValid("myapp")).toBe(false);
    expect(isUrlSchemeValid("myapp:/")).toBe(false);
    expect(isUrlSchemeValid("")).toBe(false);
  });
});

describe("isRedirectUrlValid", () => {
  const DEFAULT = "default";

  it("passes for the default redirect type regardless of URL", () => {
    expect(isRedirectUrlValid(DEFAULT, undefined, DEFAULT)).toBe(true);
    expect(isRedirectUrlValid(DEFAULT, "not a url", DEFAULT)).toBe(true);
  });

  it("requires a valid https URL for non-default types", () => {
    expect(isRedirectUrlValid("custom", "https://grovs.io", DEFAULT)).toBe(
      true
    );
    expect(isRedirectUrlValid("custom", "http://grovs.io", DEFAULT)).toBe(
      false
    );
    expect(isRedirectUrlValid("custom", undefined, DEFAULT)).toBe(false);
    expect(isRedirectUrlValid("custom", null, DEFAULT)).toBe(false);
  });
});
