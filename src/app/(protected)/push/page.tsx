import { notFound } from "next/navigation";
import { IS_ENTERPRISE } from "@/lib/edition";
import PushCampaignsPage from "@ee/app/push/PushCampaignsPage";

export default function Page() {
  if (!IS_ENTERPRISE) notFound();
  return <PushCampaignsPage />;
}
