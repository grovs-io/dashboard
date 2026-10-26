import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardSetupPanel } from "../DashboardSetupPanel";
import type { BuiltinKey } from "../builtinDashboards";
import type { SdkStatus } from "@/types";

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));

const empty: SdkStatus = {
  ios_seen_at: null,
  android_seen_at: null,
  web_seen_at: null,
  has_events: false,
  has_purchases: false,
  has_links: false,
};
const recently = new Date(Date.now() - 2 * 60_000).toISOString();

const renderPanel = (
  dashboard: BuiltinKey,
  status = empty,
  onCreateLink = vi.fn()
) => {
  render(
    <DashboardSetupPanel
      dashboard={dashboard}
      status={status}
      onCreateLink={onCreateLink}
    />
  );
  return onCreateLink;
};
const heading = () => screen.getByRole("heading", { level: 2 });
const preview = (key: string) => screen.getByTestId(`setup-preview-${key}`);

describe("DashboardSetupPanel", () => {
  it.each([
    ["", "overview", "Add the SDK to see your users"],
    ["acquisition", "acquisition", "Add the SDK to see where users come from"],
    ["engagement", "engagement", "Add the SDK to see who comes back"],
  ] as const)(
    "%s without events links each platform to its setup page",
    (key, previewKey, title) => {
      renderPanel(key);
      expect(heading()).toHaveTextContent(title);
      expect(
        screen.getByRole("link", { name: "Set up iOS SDK" })
      ).toHaveAttribute("href", "/settings/developers/ios_setup");
      expect(
        screen.getByRole("link", { name: "Set up Android SDK" })
      ).toHaveAttribute("href", "/settings/developers/android_setup");
      expect(
        screen.getByRole("link", { name: "Set up Web SDK" })
      ).toHaveAttribute("href", "/settings/developers/web_setup");
      expect(preview(previewKey)).toBeInTheDocument();
    }
  );

  it.each(["", "acquisition", "engagement"] as const)(
    "%s with the iOS SDK seen waits for its events",
    (key) => {
      renderPanel(key, { ...empty, ios_seen_at: recently });
      expect(heading()).toHaveTextContent(
        "Waiting for events from your iOS app"
      );
      const ios = screen.getByText("iOS").closest("li")!;
      expect(ios).toHaveTextContent("SDK connected · last seen 2 minutes ago");
      expect(within(ios).getByText("Waiting for events")).toBeInTheDocument();
      expect(within(ios).queryByRole("link")).toBeNull();
      expect(
        screen.getByRole("link", { name: "Set up Android SDK" })
      ).toBeInTheDocument();
    }
  );

  it("names the most recently seen platform", () => {
    renderPanel("", {
      ...empty,
      ios_seen_at: "2026-01-01T00:00:00Z",
      android_seen_at: recently,
    });
    expect(heading()).toHaveTextContent(
      "Waiting for events from your Android app"
    );
  });

  it("asks Revenue for purchases, linking to the purchases guide", () => {
    renderPanel("revenue");
    expect(heading()).toHaveTextContent("Send purchases to see revenue");
    expect(
      screen.getByText("Log purchases from the Grovs SDK in your app")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /track purchases/i })
    ).toHaveAttribute("href", expect.stringContaining("/docs/sdk/ios/revenue"));
    expect(preview("revenue")).toBeInTheDocument();
  });

  it("waits for purchase events once an SDK is seen", () => {
    renderPanel("revenue", { ...empty, android_seen_at: recently });
    expect(heading()).toHaveTextContent("Waiting for purchase events");
    expect(
      screen.getByRole("link", { name: /track purchases/i })
    ).toHaveAttribute(
      "href",
      expect.stringContaining("/docs/sdk/android/revenue")
    );
  });

  it("opens the create-link dialog from Links", async () => {
    const onCreateLink = renderPanel("links");
    expect(heading()).toHaveTextContent(
      "Create a link to see how links perform"
    );
    await userEvent.click(
      screen.getByRole("button", { name: /create a link/i })
    );
    expect(onCreateLink).toHaveBeenCalled();
    expect(preview("links")).toBeInTheDocument();
  });

  it("says no links yet when the app is already connected", () => {
    renderPanel("links", { ...empty, web_seen_at: recently, has_events: true });
    expect(heading()).toHaveTextContent("No links yet");
  });

  it("themes through tokens, so dark mode needs no extra classes", () => {
    renderPanel("");
    const panel = heading().closest("section")!;
    expect(panel.className).toContain("bg-card");
    expect(preview("overview").className).toContain("dark:bg-muted/20");
  });
});
