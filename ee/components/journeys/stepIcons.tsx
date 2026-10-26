import {
  AppWindow,
  BellRing,
  Hourglass,
  Split,
  Tag,
  type LucideIcon,
} from "lucide-react";
import type { StepType } from "@ee/types/journey";

export const STEP_ICONS: Record<StepType, LucideIcon> = {
  wait: Hourglass,
  split: Split,
  push: BellRing,
  in_app: AppWindow,
  set_attribute: Tag,
};
