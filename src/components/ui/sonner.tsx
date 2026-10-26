"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

export function Toaster() {
  const { theme = "system" } = useTheme();
  return (
    <Sonner
      position="bottom-center"
      theme={theme as "light" | "dark" | "system"}
      visibleToasts={3}
      expand={false}
      closeButton={false}
      duration={5000}
      // !important: Sonner sets its own --width inline.
      className="![--width:420px]"
      toastOptions={{
        // ToastRow renders the whole card, so Sonner's card CSS must stay off.
        unstyled: true,
        classNames: { toast: "w-full" },
      }}
    />
  );
}
