import { afterEach, describe, expect, it, vi } from "vitest";
import { isStripeOverlay, shieldStripeOverlayFocus } from "@/lib/stripeOverlay";

const add = (html: string) => {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.appendChild(host);
  return host;
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("isStripeOverlay", () => {
  it("matches a body-level Stripe lightbox and its frame", () => {
    const host = add(
      '<div data-react-aria-top-layer><div class="inner"></div><iframe name="__privateStripeFrame123"></iframe></div>'
    );
    expect(isStripeOverlay(host.querySelector("iframe"))).toBe(true);
    expect(isStripeOverlay(host.querySelector(".inner"))).toBe(true);
  });

  it("matches Stripe's native dialog backdrop", () => {
    const host = add(
      '<dialog data-stripe-backdrop-id="x"><span></span></dialog>'
    );
    expect(isStripeOverlay(host.querySelector("span"))).toBe(true);
  });

  it("ignores Stripe frames inside our dialog and unrelated elements", () => {
    const host = add(
      '<div data-slot="dialog-content"><iframe name="__privateStripeFrame1"></iframe></div><button>x</button>'
    );
    expect(isStripeOverlay(host.querySelector("iframe"))).toBe(false);
    expect(isStripeOverlay(host.querySelector("button"))).toBe(false);
    expect(isStripeOverlay(null)).toBe(false);
    expect(isStripeOverlay(document.body)).toBe(false);
  });
});

describe("shieldStripeOverlayFocus", () => {
  it("hides focus moves into the Stripe lightbox from document listeners", () => {
    const host = add(
      '<div data-slot="dialog-content"><button id="in">in</button></div><div><iframe name="__privateStripeFrame9"></iframe></div>'
    );
    const listener = vi.fn();
    document.addEventListener("focusin", listener);
    document.addEventListener("focusout", listener);
    const release = shieldStripeOverlayFocus();

    const frame = host.querySelector("iframe")!;
    const inside = host.querySelector("#in")!;
    frame.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    inside.dispatchEvent(
      new FocusEvent("focusout", { bubbles: true, relatedTarget: frame })
    );
    expect(listener).not.toHaveBeenCalled();

    inside.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(listener).toHaveBeenCalledTimes(1);

    release();
    frame.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(listener).toHaveBeenCalledTimes(2);
    document.removeEventListener("focusin", listener);
    document.removeEventListener("focusout", listener);
  });
});
