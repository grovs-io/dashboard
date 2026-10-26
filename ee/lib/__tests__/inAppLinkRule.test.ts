import { afterEach, describe, expect, it, vi } from "vitest";
import cases from "./fixtures/in-app-shared/cases.json";
import { linkAllowed, resourceAllowed } from "../inAppLinkRule";

const config = vi.hoisted(() => ({ apiUrl: "http://localhost:3000" }));
vi.mock("@/lib/config", () => ({ config }));

describe("the shared link rule", () => {
  it.each(cases.link_rule.map((c) => [c.name, c.input, c.expect] as const))(
    "%s",
    (_name, input, expected) => {
      expect(linkAllowed(input) ? "allowed" : "refused").toBe(expected);
    }
  );
});

describe("whitespace, as the server reads it", () => {
  it("takes a host only Ruby's \\s would end", () => {
    expect(linkAllowed("https://\u00a0acme.example")).toBe(true);
    expect(linkAllowed("https://\vacme.example")).toBe(false);
  });
});

describe("resources", () => {
  it("takes https with a host only", () => {
    expect(resourceAllowed("https://cdn.example/a.mp4", false)).toBe(true);
    expect(resourceAllowed(" HTTPS://cdn.example/a.png", false)).toBe(true);
    expect(resourceAllowed("http://cdn.example/a.png", false)).toBe(false);
    expect(resourceAllowed("https:foo", false)).toBe(false);
    expect(resourceAllowed("https://#x", false)).toBe(false);
    expect(linkAllowed("https://#x")).toBe(false);
    expect(resourceAllowed("myapp://x", false)).toBe(false);
    expect(resourceAllowed("a.png", false)).toBe(false);
  });

  it("takes a data image only where an image is", () => {
    expect(resourceAllowed("data:image/png;base64,AAAA", true)).toBe(true);
    expect(resourceAllowed("data:image/png;base64,AAAA", false)).toBe(false);
    expect(resourceAllowed("data:text/html,hi", true)).toBe(false);
  });
});

describe("local development resources", () => {
  afterEach(() => {
    config.apiUrl = "http://localhost:3000";
  });

  it("refuses local http when the API is not local, as the server would", () => {
    config.apiUrl = "https://api.grovs.io";
    expect(resourceAllowed("http://localhost:3000/x.png", true)).toBe(false);
    expect(resourceAllowed("http://api.lvh.me:3000/a.mp4", false)).toBe(false);
    expect(resourceAllowed("https://cdn.example/x.png", true)).toBe(true);
  });

  it("allows http only from local hosts, and only as a resource", () => {
    expect(resourceAllowed("http://localhost:3000/x.png", true)).toBe(true);
    expect(resourceAllowed("http://api.lvh.me:3000/a.mp4", false)).toBe(true);
    expect(resourceAllowed("http://127.0.0.1/a.mp3", false)).toBe(true);
    expect(resourceAllowed("http://app.localhost", false)).toBe(true);
    expect(resourceAllowed("http://localhost.evil.com/a.png", true)).toBe(
      false
    );
    expect(resourceAllowed("http://localhost@evil.com/a.png", true)).toBe(
      false
    );
    expect(linkAllowed("http://localhost:3000/x")).toBe(false);
  });
});
