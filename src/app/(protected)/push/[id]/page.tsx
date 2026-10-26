import { notFound } from "next/navigation";
import { IS_ENTERPRISE } from "@/lib/edition";
import PushReportPage from "@ee/app/push/PushReportPage";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!IS_ENTERPRISE) notFound();
  const { id } = await params;
  return <PushReportPage campaignId={id} />;
}
