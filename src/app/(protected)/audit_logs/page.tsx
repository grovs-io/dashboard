import { redirect } from "next/navigation";
import { hrefWithParams, type PageSearchParams } from "@/lib/hrefWithParams";

// Audit Logs moved under Settings.
export default async function AuditLogsRedirect({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  redirect(hrefWithParams("/settings/audit_logs", await searchParams));
}
