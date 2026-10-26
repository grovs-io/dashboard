import { notFound } from "next/navigation";
import { IS_ENTERPRISE } from "@/lib/edition";
import JourneysPage from "@ee/app/journeys/JourneysPage";

export default function Page() {
  if (!IS_ENTERPRISE) notFound();
  return <JourneysPage />;
}
