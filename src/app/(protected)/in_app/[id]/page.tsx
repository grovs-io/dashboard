import { notFound } from "next/navigation";
import { IS_ENTERPRISE } from "@/lib/edition";
import InAppReportPage from "@ee/app/in_app/InAppReportPage";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!IS_ENTERPRISE) notFound();
  const { id } = await params;
  return <InAppReportPage campaignId={id} />;
}
