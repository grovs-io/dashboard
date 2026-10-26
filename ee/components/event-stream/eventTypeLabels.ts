import type { StreamEventType } from "@ee/types/eventStream";

export const EVENT_TYPE_LABELS: Record<StreamEventType, string> = {
  view: "Views",
  open: "Opens",
  install: "Installs",
  reinstall: "Reinstalls",
  app_open: "App opens",
  time_spent: "Time spent",
  reactivation: "Reactivations",
  user_referred: "User referrals",
  screen_view: "Screen views",
  custom: "Custom events",
  purchase: "Purchases",
};
