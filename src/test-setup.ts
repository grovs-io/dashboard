import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Radix UI (Select, etc.) calls these DOM APIs, which jsdom doesn't implement.
if (typeof window !== "undefined") {
  window.HTMLElement.prototype.hasPointerCapture ??= () => false;
  window.HTMLElement.prototype.scrollIntoView ??= () => {};
}

afterEach(() => {
  cleanup();
});
