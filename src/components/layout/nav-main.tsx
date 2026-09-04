"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

// Restrained active treatment (DESIGN.md: minimal, restrained color) — accent
// text + icon and a thin left bar, NO filled surface and normal weight. The
// transparent overrides cancel the flat gray default from ui/sidebar.
const topButtonClass = cn(
  "relative transition-colors",
  "data-[active=true]:bg-transparent data-[active=true]:font-normal data-[active=true]:text-[color:var(--chart-users)]",
  "[&[data-active=true]>svg]:text-[color:var(--chart-users)]",
  "before:pointer-events-none before:absolute before:left-0 before:top-1/2 before:h-4 before:w-[2px] before:-translate-y-1/2 before:rounded-r-full before:bg-[var(--chart-users)] before:opacity-0 before:transition-opacity data-[active=true]:before:opacity-100"
);

const subButtonClass = cn(
  "transition-colors",
  "data-[active=true]:bg-transparent data-[active=true]:text-[color:var(--chart-users)] data-[active=true]:font-medium"
);

// Accent the existing tree line (the sub list's left border) for the active
// row, instead of adding a separate bar. A short centered segment matches the
// top-level bar height (h-4) so the two indicators read the same. Offset ≈ the
// sub list's px-2.5 padding + 1px border so it lands on the line; the <li> is
// already `relative`.
const subActiveLineClass =
  "before:absolute before:-left-[11px] before:top-1/2 before:h-4 before:w-[2px] before:-translate-y-1/2 before:rounded-full before:bg-[var(--chart-users)] before:content-['']";

export const RenderMenuItem = ({
  item,
  currentPath,
}: {
  item: navItemType;
  currentPath: string;
}) => {
  const { state, setOpen } = useSidebar();
  const router = useRouter();

  const searchParams = useSearchParams();
  const query = searchParams.toString();

  const returnUrlWithParams = (url: string) => {
    const urlWithParams = `${url}${query ? `?${query}` : ""}`;
    return urlWithParams;
  };

  const isActive = (url: string) => {
    return url === currentPath;
  };

  const isParentActive = (parentUrl: string, subItems?: { url: string }[]) => {
    if (parentUrl !== "#" && currentPath.startsWith(parentUrl)) {
      return true;
    }
    return subItems?.some((sub) => currentPath.startsWith(sub.url)) ?? false;
  };

  if (item.itemType === "collapsible") {
    const parentActive = isParentActive(item.url, item.items);
    return (
      <Collapsible
        key={item.title}
        asChild
        defaultOpen={parentActive}
        className="group/collapsible"
      >
        <SidebarMenuItem>
          <CollapsibleTrigger
            asChild
            onClick={() => {
              if (state === "collapsed") {
                setOpen(true);
              }
              // Navigate to first sub-item if not already on a child route
              const firstSubUrl = item.items?.[0]?.url;
              if (firstSubUrl && !isParentActive(item.url, item.items)) {
                router.push(returnUrlWithParams(firstSubUrl));
              }
            }}
          >
            <SidebarMenuButton
              tooltip={item.title}
              isActive={isActive(item.url)}
              className={cn(
                topButtonClass,
                // Tint the icon when the section contains the active page, so the
                // active section reads even when collapsed or scrolled.
                parentActive && "[&>svg]:text-[color:var(--chart-users)]"
              )}
            >
              {item.icon && <item.icon />}
              <span>{item.title}</span>
              <ChevronRight className="ml-auto size-3.5 text-muted-foreground/40 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {item.items?.map((subItem) => (
                <SidebarMenuSubItem
                  key={subItem.title}
                  className={cn(isActive(subItem.url) && subActiveLineClass)}
                >
                  <SidebarMenuSubButton
                    asChild
                    isActive={isActive(subItem.url)}
                    className={subButtonClass}
                  >
                    <Link href={returnUrlWithParams(subItem.url)}>
                      <span>{subItem.title}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  } else {
    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton
          asChild
          isActive={isActive(item.url)}
          tooltip={item.title}
          className={topButtonClass}
        >
          <Link href={returnUrlWithParams(item.url)}>
            {item.icon && <item.icon />}
            <span>{item.title}</span>
            {item.badge && (
              <span className="ml-auto text-[9px] font-semibold uppercase tracking-wider leading-none rounded bg-[var(--accent)] text-[color:var(--chart-users)] px-1.5 py-0.5">
                {item.badge}
              </span>
            )}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }
};

export interface navItemType {
  title: string;
  url: string;
  icon?: LucideIcon;
  isActive?: boolean;
  itemType: string;
  badge?: string;
  items?: {
    title: string;
    url: string;
    icon?: LucideIcon;
  }[];
}
export function NavMain({ items }: { items: navItemType[] }) {
  const pathname = usePathname();

  return (
    <SidebarGroup role="navigation" aria-label="Platform">
      <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold">
        Platform
      </SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <RenderMenuItem key={item.title} item={item} currentPath={pathname} />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
