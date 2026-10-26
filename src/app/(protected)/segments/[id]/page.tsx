import { notFound } from "next/navigation";
import { IS_ENTERPRISE } from "@/lib/edition";
import SegmentDetailPage from "@ee/app/segments/SegmentDetailPage";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!IS_ENTERPRISE) notFound();
  const { id } = await params;
  return <SegmentDetailPage segmentId={id} />;
}
