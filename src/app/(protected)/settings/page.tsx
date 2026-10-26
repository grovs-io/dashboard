"use client";

import MigrationDeepLinkRedirect from "./MigrationDeepLinkRedirect";

// Settings is split into Team and Usage & Billing; /settings opens Team
// (or forwards legacy migration links to the domain page).
export default function SettingsPage() {
  return <MigrationDeepLinkRedirect fallback="/settings/team" />;
}
