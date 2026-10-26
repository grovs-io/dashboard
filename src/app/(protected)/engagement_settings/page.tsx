import { notFound } from "next/navigation";
import { IS_ENTERPRISE } from "@/lib/edition";
import EngagementSettingsPage from "@ee/app/engagement_settings/EngagementSettingsPage";

export default function Page() {
  if (!IS_ENTERPRISE) notFound();
  return <EngagementSettingsPage />;
}
