"use client";

import { formatDistanceToNow } from "date-fns";
import { Link2, ShoppingCart } from "lucide-react";
import PlatformSetupPanel, {
  type SetupPlatform,
} from "@/components/common/PlatformSetupPanel";
import type { SdkStatus } from "@/types";
import type { BuiltinKey } from "./builtinDashboards";
import type { SetupKind } from "@/lib/sdkStatus";
import { DashboardSetupPreview } from "./DashboardSetupPreview";

const PLATFORMS = [
  {
    key: "ios",
    label: "iOS",
    needs: "Register the app and add the Grovs iOS SDK",
    href: "/settings/developers/ios_setup",
  },
  {
    key: "android",
    label: "Android",
    needs: "Register the app and add the Grovs Android SDK",
    href: "/settings/developers/android_setup",
  },
  {
    key: "web",
    label: "Web",
    needs: "Add your domain and the Grovs web SDK",
    href: "/settings/developers/web_setup",
  },
] as const;

type Copy = { title: string; description: string };

const SETUP_COPY: Record<BuiltinKey, Copy> = {
  "": {
    title: "Add the SDK to see your users",
    description:
      "Home shows new users, installs, opens and top links once your app sends data. Start with one platform.",
  },
  acquisition: {
    title: "Add the SDK to see where users come from",
    description:
      "Installs, channels, countries, campaigns and sources appear with your app's first installs.",
  },
  engagement: {
    title: "Add the SDK to see who comes back",
    description:
      "App opens, retention and your top events appear once your app sends its first open.",
  },
  revenue: {
    title: "Send purchases to see revenue",
    description:
      "Revenue, ARPU and units sold appear after your app logs its first purchase.",
  },
  links: {
    title: "Create a link to see how links perform",
    description:
      "Views, installs and opens from links appear within a minute of the first click.",
  },
};

/** Copy once an SDK has reported; `{platform}` is the most recently seen one. */
const CONNECTED_COPY: Record<BuiltinKey, Copy> = {
  "": {
    title: "Waiting for events from your {platform} app",
    description:
      "The SDK is connected. Open the app on a device and the first install and open show up here within a minute.",
  },
  acquisition: {
    title: "Waiting for events from your {platform} app",
    description:
      "Open the app on a device. Its first install appears here within a minute, with where it came from.",
  },
  engagement: {
    title: "Waiting for events from your {platform} app",
    description:
      "Open the app on a device. App opens appear within a minute; retention needs a day of users.",
  },
  revenue: {
    title: "Waiting for purchase events",
    description:
      "Purchases aren't being logged yet. Add one call after a successful purchase and revenue appears here.",
  },
  links: {
    title: "No links yet",
    description:
      "Your app is connected. Create a link and share it to see views here.",
  },
};

type PlatformKey = (typeof PLATFORMS)[number]["key"];

function seenAt(status: SdkStatus, key: PlatformKey): string | null {
  return status[`${key}_seen_at`];
}

function latestPlatform(status: SdkStatus) {
  let best: (typeof PLATFORMS)[number] | undefined;
  let bestAt = 0;
  for (const p of PLATFORMS) {
    const at = seenAt(status, p.key);
    const t = at ? new Date(at).getTime() : 0;
    if (t > bestAt) {
      best = p;
      bestAt = t;
    }
  }
  return best;
}

export function DashboardSetupPanel({
  dashboard,
  status,
  onCreateLink,
}: {
  dashboard: BuiltinKey;
  status: SdkStatus;
  onCreateLink: () => void;
}) {
  const latest = latestPlatform(status);
  const kind: SetupKind =
    dashboard === "revenue"
      ? "purchases"
      : dashboard === "links"
        ? "links"
        : "events";
  const copy = latest ? CONNECTED_COPY[dashboard] : SETUP_COPY[dashboard];
  const title = copy.title.replace("{platform}", latest?.label ?? "");

  let rows: SetupPlatform[];
  if (kind === "events") {
    rows = PLATFORMS.map((p) => {
      const at = seenAt(status, p.key);
      return at
        ? {
            ...p,
            needs: `SDK connected · last seen ${formatDistanceToNow(new Date(at), { addSuffix: true })}`,
            waiting: "Waiting for events",
          }
        : { ...p };
    });
  } else if (kind === "purchases") {
    const sdk =
      !status.ios_seen_at && status.android_seen_at ? "android" : "ios";
    rows = [
      {
        key: "purchases",
        label: "Purchases",
        needs: "Log purchases from the Grovs SDK in your app",
        icon: <ShoppingCart className="size-[22px]" />,
        actionLabel: "Track purchases",
        href: `${process.env.NEXT_PUBLIC_DOCS_URL}/docs/sdk/${sdk}/revenue`,
      },
    ];
  } else {
    rows = [
      {
        key: "links",
        label: "Links",
        needs: "Create a link and share it anywhere",
        icon: <Link2 className="size-[22px]" />,
        actionLabel: "Create a link",
        onAction: onCreateLink,
      },
    ];
  }

  return (
    <PlatformSetupPanel
      title={title}
      description={copy.description}
      platforms={rows}
      noun="SDK"
      preview={<DashboardSetupPreview dashboard={dashboard} />}
    />
  );
}
