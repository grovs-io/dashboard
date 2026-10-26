import { redirect } from "next/navigation";
import { hrefWithParams, type PageSearchParams } from "@/lib/hrefWithParams";

export default async function DevelopersPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  redirect(
    hrefWithParams("/settings/developers/access_key", await searchParams)
  );
}
