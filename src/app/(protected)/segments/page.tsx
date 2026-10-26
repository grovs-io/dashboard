import { notFound } from "next/navigation";
import { IS_ENTERPRISE } from "@/lib/edition";
import SegmentsPage from "@ee/app/segments/SegmentsPage";

export default function Page() {
  if (!IS_ENTERPRISE) notFound();
  return <SegmentsPage />;
}
