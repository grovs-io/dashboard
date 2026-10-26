import { notFound } from "next/navigation";
import { IS_ENTERPRISE } from "@/lib/edition";
import InAppCampaignsPage from "@ee/app/in_app/InAppCampaignsPage";

export default function Page() {
  if (!IS_ENTERPRISE) notFound();
  return <InAppCampaignsPage />;
}
