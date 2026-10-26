const STRIPE_FRAME = 'iframe[name^="__privateStripeFrame"]';
const OUR_DIALOG = '[data-slot="dialog-content"]';

// Stripe's 3DS/Link lightbox: a body-level container holding a Stripe frame, outside our Radix dialog.
export const isStripeOverlay = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element) || target.closest(OUR_DIALOG)) {
    return false;
  }
  if (target.closest("[data-stripe-backdrop-id]")) return true;
  let top: Element = target;
  while (top.parentElement && top.parentElement !== document.body) {
    top = top.parentElement;
  }
  if (top.parentElement !== document.body) return false;
  if (top.matches(STRIPE_FRAME)) return true;
  return Array.from(top.querySelectorAll(STRIPE_FRAME)).some(
    (frame) => !frame.closest(OUR_DIALOG)
  );
};

// Radix's focus trap pulls focus back from outside frames; hide those moves from it while paying.
export const shieldStripeOverlayFocus = () => {
  const shield = (event: FocusEvent) => {
    if (isStripeOverlay(event.target) || isStripeOverlay(event.relatedTarget)) {
      event.stopImmediatePropagation();
    }
  };
  window.addEventListener("focusin", shield, true);
  window.addEventListener("focusout", shield, true);
  return () => {
    window.removeEventListener("focusin", shield, true);
    window.removeEventListener("focusout", shield, true);
  };
};

// Stripe's test-mode helper pill sits on <body> and outlives the payment form; drop it once the form is gone.
export const removeStripeTestHelper = () => {
  setTimeout(() => {
    document
      .querySelectorAll('body > iframe[src*="elements-inner-easel"]')
      .forEach((frame) => frame.remove());
  });
};
