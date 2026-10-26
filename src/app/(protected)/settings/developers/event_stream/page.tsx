import { notFound } from "next/navigation";
import { IS_ENTERPRISE } from "@/lib/edition";
import EventStreamPage from "@ee/app/event_stream/EventStreamPage";

export default function Page() {
  if (!IS_ENTERPRISE) notFound();
  return <EventStreamPage />;
}
