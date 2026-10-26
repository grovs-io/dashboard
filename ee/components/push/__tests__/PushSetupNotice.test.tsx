import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import PushSetupNotice from "../PushSetupNotice";

const card = () =>
  screen.getByRole("note", { name: "Set up push notifications" });
const cell = (platform: "ios" | "android") =>
  card().querySelector<HTMLElement>(`[data-platform="${platform}"]`)!;

describe("PushSetupNotice", () => {
  it("renders nothing while unknown or when both platforms are set up", () => {
    const { container, rerender } = render(<PushSetupNotice channels={null} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<PushSetupNotice channels={{ ios: true, android: true }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the full card with both platforms when none is set up", () => {
    render(<PushSetupNotice channels={{ ios: false, android: false }} />);
    expect(
      within(card()).getByText("Set up push notifications")
    ).toBeInTheDocument();
    expect(card()).toHaveTextContent(
      "Campaigns reach devices through Apple (APNs) and Google (Firebase)."
    );
    expect(card()).toHaveClass("max-w-[752px]");
    expect(cell("ios")).toHaveTextContent("iOSNot configured");
    expect(cell("android")).toHaveTextContent("AndroidNot configured");
    expect(
      within(cell("ios")).getByRole("link", { name: "Set up iOS push" })
    ).toHaveAttribute("href", "/settings/developers/ios_setup");
    const android = within(cell("android")).getByRole("link", {
      name: "Set up Android push",
    });
    expect(android).toHaveAttribute(
      "href",
      "/settings/developers/android_setup"
    );
    expect(android).not.toHaveAttribute("target");
  });

  it("shows one compact row for the missing platform only", () => {
    render(<PushSetupNotice channels={{ ios: true, android: false }} />);
    const row = screen.getByRole("note", {
      name: "Android push isn't configured",
    });
    expect(row).toHaveTextContent(
      "Android push isn't configured — Android devices won't receive campaigns."
    );
    expect(row).not.toHaveClass("max-w-[752px]");
    expect(
      within(row).getByRole("link", { name: "Set up Android push" })
    ).toHaveAttribute("href", "/settings/developers/android_setup");
    expect(within(row).getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByText("Set up push notifications")).toBeNull();
    expect(screen.queryByText(/iOS/)).toBeNull();
  });

  it("drops the consequence sentence with hideConsequence", () => {
    render(
      <PushSetupNotice
        channels={{ ios: true, android: false }}
        hideConsequence
      />
    );
    const row = screen.getByRole("note", {
      name: "Android push isn't configured",
    });
    expect(row).toHaveTextContent("Android push isn't configured");
    expect(row).not.toHaveTextContent("won't receive campaigns");
    expect(
      within(row).getByRole("link", { name: "Set up Android push" })
    ).toBeInTheDocument();
  });

  it("opens the links in a new tab when asked, in both variants", () => {
    const { rerender } = render(
      <PushSetupNotice channels={{ ios: false, android: false }} newTab />
    );
    for (const name of ["Set up iOS push", "Set up Android push"]) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
    rerender(
      <PushSetupNotice channels={{ ios: false, android: true }} newTab />
    );
    expect(
      screen.getByRole("link", { name: "Set up iOS push" })
    ).toHaveAttribute("target", "_blank");
  });
});
