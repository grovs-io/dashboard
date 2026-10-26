import { redirect } from "next/navigation";
import { bannerDialogHref } from "@/lib/smartBannerRoutes";
import type { PageSearchParams } from "@/lib/hrefWithParams";

// The composer is a dialog over the list.
export default async function NewSmartBannerPage({
  searchParams,
}: {
  searchParams?: Promise<PageSearchParams>;
}) {
  redirect(bannerDialogHref("new", await searchParams));
}
