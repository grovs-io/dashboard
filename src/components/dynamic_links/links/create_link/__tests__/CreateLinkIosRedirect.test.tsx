import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CreateLinkIosRedirect from "../CreateLinkIosRedirect";
import {
  APP_OR_FALLBACK,
  AUTOMATIC,
  DEFAULT,
} from "@/constants/OptionsConstants";

// Project defaults: preview on, clipboard copy on. A link that overrides neither
// must keep inheriting both.
const renderRedirect = (overrides = {}) => {
  const setShowPreviewIOS = vi.fn();
  const setCopyToClipboardIOS = vi.fn();

  const props = {
    iosRedirectURL: { url: "https://example.com", open_app_if_installed: true },
    iosRedirectType: APP_OR_FALLBACK,
    setIosRedirectURL: vi.fn(),
    setIosRedirectType: vi.fn(),
    iosLinkBehaviour: DEFAULT,
    setIosLinkBehaviour: vi.fn(),
    setShowPreviewIOS,
    copyToClipboardIOS: null,
    setCopyToClipboardIOS,
    projectShowPreviewIOS: true,
    projectCopyToClipboardIOS: true,
    ...overrides,
  };

  const { rerender } = render(<CreateLinkIosRedirect {...props} />);
  return { setShowPreviewIOS, setCopyToClipboardIOS, props, rerender };
};

const choosePreview = (title: string) => {
  fireEvent.click(
    screen.getByText("App preview page").parentElement!.querySelector("button")!
  );
  fireEvent.click(screen.getByText(title));
};

describe("CreateLinkIosRedirect preview + clipboard", () => {
  it("shows the clipboard toggle when the preview is inherited and on", () => {
    renderRedirect();
    expect(screen.getByText("Copy link to clipboard")).toBeInTheDocument();
  });

  it("hides the clipboard toggle when the link skips the preview", () => {
    renderRedirect({ iosLinkBehaviour: AUTOMATIC });
    expect(
      screen.queryByText("Copy link to clipboard")
    ).not.toBeInTheDocument();
  });

  it("reflects the project default in the toggle when the link inherits", () => {
    renderRedirect();
    expect(screen.getByRole("switch")).toBeChecked();
  });

  // Regression: forcing the copy flag to false on a preview change wrote a
  // per-link override that survived switching back to Default.
  it("never writes a copy override when the preview choice changes", () => {
    const { setShowPreviewIOS, setCopyToClipboardIOS } = renderRedirect();

    choosePreview("Skip preview page");

    expect(setShowPreviewIOS).toHaveBeenCalledWith(false);
    expect(setCopyToClipboardIOS).not.toHaveBeenCalled();
  });

  // Switching the redirect type back to Default hides the preview and clipboard
  // controls, so the overrides they set must go with them.
  it("clears both overrides when the redirect type goes back to Default", () => {
    const { setShowPreviewIOS, setCopyToClipboardIOS, props } = renderRedirect({
      iosLinkBehaviour: AUTOMATIC,
      copyToClipboardIOS: true,
    });

    fireEvent.click(screen.getByText("App or Fallback"));
    fireEvent.click(
      screen
        .getByText("Uses the project's default redirect settings.")
        .closest("button")!
    );

    expect(props.setIosRedirectType).toHaveBeenCalledWith(DEFAULT);
    expect(props.setIosLinkBehaviour).toHaveBeenCalledWith(DEFAULT);
    expect(setShowPreviewIOS).toHaveBeenCalledWith(null);
    expect(setCopyToClipboardIOS).toHaveBeenCalledWith(null);
  });

  it("leaves the overrides alone when picking a non-default redirect", () => {
    const { setShowPreviewIOS, setCopyToClipboardIOS } = renderRedirect();

    fireEvent.click(screen.getByText("App or Fallback"));
    fireEvent.click(
      screen
        .getByText("Redirects iOS users to a custom web URL.")
        .closest("button")!
    );

    expect(setShowPreviewIOS).not.toHaveBeenCalled();
    expect(setCopyToClipboardIOS).not.toHaveBeenCalled();
  });

  it("still lets the user set the copy flag directly", () => {
    const { setCopyToClipboardIOS } = renderRedirect();

    fireEvent.click(screen.getByRole("switch"));

    expect(setCopyToClipboardIOS).toHaveBeenCalledWith(false);
  });
});
