import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GALLERY } from "@ee/lib/inAppHtmlGallery";
import Gallery, { thumbnailHtml } from "../html/Gallery";

describe("Gallery", () => {
  it("shows every example with its layout and picks one", async () => {
    const onPick = vi.fn();
    render(<Gallery onPick={onPick} />);
    for (const example of GALLERY)
      expect(
        screen.getByRole("button", { name: new RegExp(`^${example.title}`) })
      ).toBeInTheDocument();
    expect(screen.getAllByText("Card in the middle").length).toBeGreaterThan(0);
    await userEvent.click(
      screen.getByRole("button", { name: /^Countdown offer/ })
    );
    expect(onPick).toHaveBeenCalledWith(
      GALLERY.find((e) => e.id === "countdown-offer")
    );
  });

  it("draws thumbnails without running their scripts", () => {
    render(<Gallery onPick={vi.fn()} />);
    const frames = document.querySelectorAll("iframe");
    expect(frames).toHaveLength(GALLERY.length);
    for (const frame of frames) {
      expect(frame.getAttribute("sandbox")).toBe("allow-same-origin");
      expect(frame.getAttribute("tabindex")).toBe("-1");
    }
  });

  it("fills fields with the sample person or their defaults", () => {
    expect(
      thumbnailHtml(
        '<p title="{{ user.plan }}">Hi {{ user.first_name | default: "there" }}, {{ user.nickname | default: "friend" }} {{ event.total }}</p>'
      )
    ).toBe('<p title="pro">Hi Alex, friend </p>');
  });

  it("follows the dashboard's theme, not the computer's", () => {
    const css = "@media (prefers-color-scheme: dark) { p { color: red } }";
    expect(thumbnailHtml(css, true)).toBe("@media all { p { color: red } }");
    expect(thumbnailHtml(css, false)).toBe(
      "@media not all { p { color: red } }"
    );
  });
});
