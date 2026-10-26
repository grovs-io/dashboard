export type StatusTone = "grey" | "blue" | "green" | "red" | "amber" | "muted";

// Shared by every status pill: push, in-app, journeys and smart banners.
export const TONE_CLASSES: Record<StatusTone, string> = {
  grey: "bg-muted text-muted-foreground border-transparent",
  blue: "bg-chart-users/10 text-chart-users border-transparent",
  green: "bg-valid-green/10 text-valid-green border-transparent",
  red: "bg-destructive/10 text-destructive border-transparent",
  amber:
    "bg-amber-500/10 text-amber-600 border-transparent dark:text-amber-400",
  muted: "bg-transparent text-muted-foreground border-sidebar-border",
};
