import { describe, expect, it } from "vitest";
import { isDomainValid } from "@/lib/domainValidation";

describe("isDomainValid", () => {
  it("accepts http(s) domains and localhost", () => {
    expect(isDomainValid("https://example.com")).toBe(true);
    expect(isDomainValid("http://localhost:3000")).toBe(true);
  });

  it("accepts file:// for Electron builds", () => {
    expect(isDomainValid("file://")).toBe(true);
  });

  it("rejects other schemes and file paths", () => {
    expect(isDomainValid("ftp://example.com")).toBe(false);
    expect(isDomainValid("file:///Users/app/index.html")).toBe(false);
    expect(isDomainValid("example.com")).toBe(false);
  });
});
