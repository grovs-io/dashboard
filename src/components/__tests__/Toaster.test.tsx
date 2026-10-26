import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

const sonnerProps: { current: Record<string, unknown> | null } = {
  current: null,
};
vi.mock("sonner", () => ({
  Toaster: (props: Record<string, unknown>) => {
    sonnerProps.current = props;
    return null;
  },
}));
vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light" }),
}));

import { Toaster } from "../ui/sonner";

describe("Toaster", () => {
  it("renders Sonner with the owner-approved placement and behavior", () => {
    render(<Toaster />);
    const props = sonnerProps.current!;
    expect(props.position).toBe("bottom-center");
    expect(props.richColors).toBeUndefined();
    // Sonner's floating circular close button is off; Notifications.tsx renders its own inline close instead.
    expect(props.closeButton).toBe(false);
    expect(props.visibleToasts).toBe(3);
    expect(props.expand).toBe(false);
    expect(props.duration).toBe(5000);
  });

  it("caps the toast container at 420px on desktop", () => {
    render(<Toaster />);
    expect(sonnerProps.current!.style).toBeUndefined();
    expect(sonnerProps.current!.className).toBe("![--width:420px]");
  });

  it("stays unstyled so Notifications.tsx's ToastRow owns the whole card", () => {
    render(<Toaster />);
    const toastOptions = sonnerProps.current!.toastOptions as {
      unstyled: boolean;
      classNames: { toast: string };
    };
    expect(toastOptions.unstyled).toBe(true);
    expect(toastOptions.classNames.toast).toBe("w-full");
  });
});
