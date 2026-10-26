import { redirect } from "next/navigation";
import { SMART_BANNERS_PATH, bannerDialogHref } from "@/lib/smartBannerRoutes";
import { hrefWithParams, type PageSearchParams } from "@/lib/hrefWithParams";

// The editor is a dialog over the list.
export default async function EditSmartBannerPage({
  params,
  searchParams,
}: {
  params: Promise<{ bannerId: string }>;
  searchParams?: Promise<PageSearchParams>;
}) {
  const { bannerId } = await params;
  const query = await searchParams;
  redirect(
    /^\d+$/.test(bannerId)
      ? bannerDialogHref(bannerId, query)
      : hrefWithParams(SMART_BANNERS_PATH, query)
  );
}
