import { redirect } from "next/navigation";
import { hrefWithParams, type PageSearchParams } from "@/lib/hrefWithParams";
import { SMART_BANNERS_PATH } from "@/lib/smartBannerRoutes";

// Old Links Behaviour URLs. The proxy alias handles hard loads; this catches
// soft navigations: smart_banners/* moved to the top level, the rest under
// /dynamic_links/settings.
export default async function LinkBehaviourRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ rest?: string[] }>;
  searchParams: Promise<PageSearchParams>;
}) {
  const [first, ...more] = (await params).rest ?? [];
  const path =
    first === "smart_banners"
      ? [SMART_BANNERS_PATH, ...more].join("/")
      : ["/dynamic_links/settings", ...(first ? [first, ...more] : [])].join(
          "/"
        );
  redirect(hrefWithParams(path, await searchParams));
}
