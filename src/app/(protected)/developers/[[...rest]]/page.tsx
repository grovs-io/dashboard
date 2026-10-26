import { redirect } from "next/navigation";
import { hrefWithParams, type PageSearchParams } from "@/lib/hrefWithParams";

// Developers moved under Settings. The proxy alias handles hard loads; this
// catches soft navigations.
export default async function DevelopersRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ rest?: string[] }>;
  searchParams: Promise<PageSearchParams>;
}) {
  const rest = (await params).rest ?? [];
  redirect(
    hrefWithParams(
      ["/settings/developers", ...rest].join("/"),
      await searchParams
    )
  );
}
