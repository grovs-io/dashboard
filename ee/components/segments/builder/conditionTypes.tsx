import {
  Activity,
  CalendarDays,
  CreditCard,
  Fingerprint,
  Megaphone,
  Smartphone,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { SegmentConditionType } from "@ee/types/segments";

export const CONDITION_TYPES: {
  type: SegmentConditionType;
  label: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    type: "event",
    label: "Did an event",
    description: "Opens, installs, views or a custom event",
    icon: Activity,
  },
  {
    type: "device",
    label: "Device",
    description: "Platform, OS, app version, country…",
    icon: Smartphone,
  },
  {
    type: "profile",
    label: "Profile property",
    description: "Attributes your app set on the user",
    icon: UserRound,
  },
  {
    type: "first_seen",
    label: "First seen",
    description: "When the user first appeared",
    icon: CalendarDays,
  },
  {
    type: "identifier",
    label: "Identifier",
    description: "Your own user id, or an uploaded list",
    icon: Fingerprint,
  },
  {
    type: "acquisition",
    label: "Acquired via",
    description: "Link, campaign, source or medium",
    icon: Megaphone,
  },
  {
    type: "purchase",
    label: "Purchase",
    description: "In-app purchases and subscriptions",
    icon: CreditCard,
  },
];

export const CONDITION_LABELS = Object.fromEntries(
  CONDITION_TYPES.map((t) => [t.type, t.label])
) as Record<SegmentConditionType, string>;
