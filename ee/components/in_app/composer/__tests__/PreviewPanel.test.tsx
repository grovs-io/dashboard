import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { emptyDraft, type InAppDraft } from "@ee/lib/inAppComposer";
import PreviewPanel from "../PreviewPanel";

const draft = (over: Partial<InAppDraft> = {}) => ({
  ...emptyDraft(),
  title: "Hello",
  ...over,
});

describe("PreviewPanel in landscape", () => {
  it("draws a card inside the safe area of a phone on its side", () => {
    render(<PreviewPanel draft={draft()} />);
    fireEvent.click(screen.getByRole("radio", { name: "Phone landscape" }));
    const frame = screen.getByRole("img", {
      name: "Message preview, landscape",
    });
    expect(frame).toHaveAttribute("data-device", "landscape");
    expect(screen.getByTestId("landscape-island")).toBeInTheDocument();
    const area = screen.getByTestId("in-app-preview-card").parentElement!;
    expect(area.style.left).toBe("59px");
    expect(area.style.bottom).toBe("21px");
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("keeps a header's content clear of the island", () => {
    render(<PreviewPanel draft={draft({ template: "header" })} />);
    fireEvent.click(screen.getByRole("radio", { name: "Phone landscape" }));
    const card = screen.getByTestId("in-app-preview-card");
    expect(card.style.paddingLeft).toBe("71px");
    expect(card).toHaveClass("top-0");
  });

  it("uses the landscape picture when there is one", () => {
    render(
      <PreviewPanel
        draft={draft({
          template: "interstitial_image",
          image: {
            portrait: "https://cdn.example/p.png",
            landscape: "https://cdn.example/l.png",
          },
        })}
      />
    );
    const src = () =>
      screen.getByTestId("in-app-preview-card").querySelector("img")!.src;
    expect(src()).toBe("https://cdn.example/p.png");
    fireEvent.click(screen.getByRole("radio", { name: "Phone landscape" }));
    expect(src()).toBe("https://cdn.example/l.png");
  });
});
