import { redirect } from "next/navigation";
import { hrefWithParams, type PageSearchParams } from "@/lib/hrefWithParams";

export default async function LinkSettingsPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  redirect(
    hrefWithParams("/dynamic_links/settings/redirect_rules", await searchParams)
  );
}
