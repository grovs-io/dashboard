import { afterEach, describe, expect, it, vi } from "vitest";
import { allConfigured } from "../integrations";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("allConfigured", () => {
  it("requires every integration value to be non-empty", () => {
    expect(allConfigured("key")).toBe(true);
    expect(allConfigured("url", "token")).toBe(true);
    expect(allConfigured("url", "")).toBe(false);
    expect(allConfigured("url", "   ")).toBe(false);
    expect(allConfigured(undefined)).toBe(false);
  });
});

describe("integration policy", () => {
  it("enables PostHog and GTM from their variables in self-hosted mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_SELF_HOSTED", "true");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "posthog-key");
    vi.stubEnv("NEXT_PUBLIC_GTM_ID", "GTM-123");

    const integrations = await import("../integrations");

    expect(integrations.POSTHOG_ENABLED).toBe(true);
    expect(integrations.GTM_ENABLED).toBe(true);
  });

  it("always disables Chatwoot in self-hosted mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_SELF_HOSTED", "true");
    vi.stubEnv("NEXT_PUBLIC_CHATWOOT_URL", "https://chat.example.com");
    vi.stubEnv("NEXT_PUBLIC_CHATWOOT_TOKEN", "token");

    const integrations = await import("../integrations");

    expect(integrations.CHATWOOT_ENABLED).toBe(false);
  });

  it("enables Chatwoot outside self-hosted mode only with URL and token", async () => {
    vi.stubEnv("NEXT_PUBLIC_SELF_HOSTED", "false");
    vi.stubEnv("NEXT_PUBLIC_CHATWOOT_URL", "https://chat.example.com");
    vi.stubEnv("NEXT_PUBLIC_CHATWOOT_TOKEN", "token");

    let integrations = await import("../integrations");
    expect(integrations.CHATWOOT_ENABLED).toBe(true);

    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_CHATWOOT_TOKEN", "");
    integrations = await import("../integrations");
    expect(integrations.CHATWOOT_ENABLED).toBe(false);
  });
});
