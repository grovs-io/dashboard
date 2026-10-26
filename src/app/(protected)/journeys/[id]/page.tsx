import { notFound } from "next/navigation";
import { IS_ENTERPRISE } from "@/lib/edition";
import JourneyReportPage from "@ee/app/journeys/JourneyReportPage";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!IS_ENTERPRISE) notFound();
  const { id } = await params;
  return <JourneyReportPage journeyId={id} />;
}
