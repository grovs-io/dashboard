import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CreateLinkAndroidRedirect from "../CreateLinkAndroidRedirect";
import { APP_OR_FALLBACK, DEFAULT } from "@/constants/OptionsConstants";

// The Android and iOS redirect components are hand-maintained twins. The iOS
// suite covers the behaviour in full; these pin the two regressions on the twin
// so a change to one can't silently skip the other.
const renderRedirect = (overrides = {}) => {
  const setShowPreviewAndroid = vi.fn();
  const setCopyToClipboardAndroid = vi.fn();
  const setAndroidRedirectType = vi.fn();
  const setAndroidLinkBehaviour = vi.fn();

  render(
    <CreateLinkAndroidRedirect
      androidRedirectURL={{
        url: "https://example.com",
        open_app_if_installed: true,
      }}
      androidRedirectType={APP_OR_FALLBACK}
      setAndroidRedirectURL={vi.fn()}
      setAndroidRedirectType={setAndroidRedirectType}
      androidLinkBehaviour={DEFAULT}
      setAndroidLinkBehaviour={setAndroidLinkBehaviour}
      setShowPreviewAndroid={setShowPreviewAndroid}
      copyToClipboardAndroid={null}
      setCopyToClipboardAndroid={setCopyToClipboardAndroid}
      projectShowPreviewAndroid
      projectCopyToClipboardAndroid
      {...overrides}
    />
  );

  return {
    setShowPreviewAndroid,
    setCopyToClipboardAndroid,
    setAndroidRedirectType,
    setAndroidLinkBehaviour,
  };
};

describe("CreateLinkAndroidRedirect preview + clipboard", () => {
  it("never writes a copy override when the preview choice changes", () => {
    const { setShowPreviewAndroid, setCopyToClipboardAndroid } =
      renderRedirect();

    fireEvent.click(
      screen
        .getByText("App preview page")
        .parentElement!.querySelector("button")!
    );
    fireEvent.click(screen.getByText("Skip preview page"));

    expect(setShowPreviewAndroid).toHaveBeenCalledWith(false);
    expect(setCopyToClipboardAndroid).not.toHaveBeenCalled();
  });

  it("clears both overrides when the redirect type goes back to Default", () => {
    const {
      setShowPreviewAndroid,
      setCopyToClipboardAndroid,
      setAndroidLinkBehaviour,
    } = renderRedirect({ copyToClipboardAndroid: true });

    fireEvent.click(screen.getByText("App or Fallback"));
    fireEvent.click(
      screen
        .getByText("Uses the project's default redirect settings.")
        .closest("button")!
    );

    expect(setAndroidLinkBehaviour).toHaveBeenCalledWith(DEFAULT);
    expect(setShowPreviewAndroid).toHaveBeenCalledWith(null);
    expect(setCopyToClipboardAndroid).toHaveBeenCalledWith(null);
  });
});
