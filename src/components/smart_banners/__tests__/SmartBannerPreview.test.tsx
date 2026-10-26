import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  SAMPLE_BANNER,
  SmartBannerBar,
  SmartBannerPhone,
  SmartBannerPreviewPanel,
} from "../SmartBannerPreview";

describe("SmartBannerBar", () => {
  it("renders the SDK's sizes and the banner's colours", () => {
    render(
      <SmartBannerBar
        {...SAMPLE_BANNER}
        iconUrl="https://cdn/icon.png"
        backgroundColor="#000000"
        buttonColor="#FF0000"
      />
    );
    const bar = screen.getByTestId("smart-banner-preview");
    expect(bar).toHaveStyle({ backgroundColor: "#000000" });
    expect(screen.getByRole("img", { name: "App icon" })).toHaveClass(
      "size-10",
      "rounded-[9px]"
    );
    expect(screen.getByText("Open")).toHaveClass("rounded-full");
    expect(screen.getByText("Open")).toHaveStyle({
      backgroundColor: "#FF0000",
    });
    expect(bar).toHaveTextContent("Faster checkout in our app");
  });

  it("drops the icon and subtitle when they are empty", () => {
    render(<SmartBannerBar {...SAMPLE_BANNER} subtitle="" />);
    expect(screen.queryByRole("img", { name: "App icon" })).toBeNull();
    expect(screen.getByTestId("smart-banner-preview")).not.toHaveTextContent(
      "Faster checkout"
    );
  });
});

describe("SmartBannerPhone", () => {
  it("lays a top banner under the browser chrome, pushing the page down", () => {
    render(<SmartBannerPhone platform="android" {...SAMPLE_BANNER} />);
    const bar = screen.getByTestId("smart-banner-preview");
    const page = screen.getByTestId("smart-banner-page");
    expect(page).not.toContainElement(bar);
    expect(
      screen.getByTestId("browser-chrome").compareDocumentPosition(bar) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      bar.compareDocumentPosition(page) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("floats a bottom banner over the page, above Safari's bottom bar", () => {
    render(
      <SmartBannerPhone platform="ios" {...SAMPLE_BANNER} position="bottom" />
    );
    const bar = screen.getByTestId("smart-banner-preview");
    expect(screen.getByTestId("smart-banner-page")).toContainElement(bar);
    expect(bar.parentElement).toHaveClass("absolute", "bottom-0");
    expect(
      bar.compareDocumentPosition(screen.getByTestId("browser-chrome")) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("draws each platform's phone and browser, with the linked domain", () => {
    const { rerender } = render(
      <SmartBannerPhone platform="ios" {...SAMPLE_BANNER} />
    );
    expect(screen.getByTestId("dynamic-island")).toBeInTheDocument();
    expect(screen.getByTestId("browser-chrome")).toHaveAttribute(
      "data-browser",
      "safari"
    );
    expect(screen.getByText("yourshop.com")).toBeInTheDocument();
    rerender(
      <SmartBannerPhone
        platform="android"
        {...SAMPLE_BANNER}
        domain="shop.com"
      />
    );
    expect(screen.getByTestId("punch-hole")).toBeInTheDocument();
    expect(screen.queryByTestId("dynamic-island")).toBeNull();
    expect(screen.getByTestId("browser-chrome")).toHaveAttribute(
      "data-browser",
      "chrome"
    );
    expect(screen.getByText("shop.com")).toBeInTheDocument();
  });

  it("shows the address bar without the scheme, and a file:// origin as 'Local file'", () => {
    const { rerender } = render(
      <SmartBannerPhone
        platform="ios"
        {...SAMPLE_BANNER}
        domain="https://shop.com"
      />
    );
    expect(screen.getByText("shop.com")).toBeInTheDocument();
    expect(screen.queryByText("https://shop.com")).toBeNull();

    rerender(
      <SmartBannerPhone
        platform="android"
        {...SAMPLE_BANNER}
        domain="http://shop.com"
      />
    );
    expect(screen.getByText("shop.com")).toBeInTheDocument();

    rerender(
      <SmartBannerPhone platform="ios" {...SAMPLE_BANNER} domain="file://" />
    );
    expect(screen.getByText("Local file")).toBeInTheDocument();
  });
});

describe("SmartBannerPreviewPanel", () => {
  const radio = (name: string) =>
    within(screen.getByRole("radiogroup", { name: "Preview on" })).getByRole(
      "radio",
      { name }
    );

  it("switches the phone and browser without changing the banner", async () => {
    render(<SmartBannerPreviewPanel look={SAMPLE_BANNER} />);
    const before = screen.getByTestId("smart-banner-preview").outerHTML;
    const frame = screen.getByRole("img", { name: /Smart banner preview/ });
    const size = [
      frame.parentElement!.style.width,
      frame.parentElement!.style.height,
    ];
    expect(radio("iOS")).toHaveAttribute("aria-checked", "true");

    await userEvent.click(radio("Android"));
    expect(radio("Android")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("smart-banner-phone")).toHaveAttribute(
      "data-platform",
      "android"
    );
    expect(screen.getByTestId("browser-chrome")).toHaveAttribute(
      "data-browser",
      "chrome"
    );
    expect(screen.getByTestId("smart-banner-preview").outerHTML).toBe(before);
    const after = screen.getByRole("img", { name: /Smart banner preview/ });
    expect([
      after.parentElement!.style.width,
      after.parentElement!.style.height,
    ]).toEqual(size);
    expect(screen.getByText(/Android, Chrome/)).toBeInTheDocument();
  });

  it("disables the platform the banner doesn't target", () => {
    render(
      <SmartBannerPreviewPanel look={SAMPLE_BANNER} platforms={["android"]} />
    );
    expect(radio("iOS")).toBeDisabled();
    expect(radio("Android")).toHaveAttribute("aria-checked", "true");
  });
});
