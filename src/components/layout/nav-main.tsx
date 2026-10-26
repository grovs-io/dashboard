"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { useState, type ComponentType, type SVGProps } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { withNavQuery } from "@/components/layout/navConfig";

const activeClass =
  "data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-foreground [&[data-active=true]>svg]:text-foreground";

const rowClass = cn(
  "h-8 gap-2 rounded-[7px] text-[13.5px] transition-colors",
  activeClass
);

const subRowClass = cn(
  "h-7 translate-x-0 rounded-[7px] text-[13px] text-muted-foreground transition-colors hover:text-foreground",
  activeClass
);

const childIconClass = (active: boolean) =>
  cn("!size-3.5", active ? "text-foreground" : "text-muted-foreground");

// Child content (icon or text) lines up under the group label (px-2 + icon + gap = pl-6 + px-2).
const subListClass = "mx-0 gap-0.5 border-l-0 px-0 pl-6 py-0.5";

const chevronClass =
  "ml-auto !size-3.5 text-muted-foreground/60 transition-transform duration-200";

const useNav = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // A detail route (/segments/abc) keeps its page highlighted.
  const isActive = (url: string) =>
    url === pathname || (url !== "/" && pathname.startsWith(`${url}/`));
  const href = (url: string) => withNavQuery(url, searchParams);
  return { pathname, isActive, href };
};

export function NavItem({ item }: { item: navItemType }) {
  const { isActive, href } = useNav();
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive(item.url)}
        tooltip={item.title}
        className={rowClass}
      >
        <Link href={href(item.url)}>
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

export function NavGroup({
  label,
  icon: Icon,
  items,
  open,
  active,
  onOpenChange,
}: {
  label: string;
  icon?: LucideIcon;
  items: navItemType[];
  open: boolean;
  active: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state, setOpen, isMobile } = useSidebar();
  return (
    <Collapsible
      asChild
      open={open}
      onOpenChange={onOpenChange}
      className="group/collapsible"
    >
      <SidebarMenuItem>
        <CollapsibleTrigger
          asChild
          onClick={(e) => {
            // Desktop icon-only mode has nowhere to show children; the mobile sheet always does.
            if (!isMobile && state === "collapsed") {
              e.preventDefault();
              setOpen(true);
              onOpenChange(true);
            }
          }}
        >
          <SidebarMenuButton
            tooltip={label}
            className={cn(
              rowClass,
              active && "text-foreground [&>svg]:text-foreground"
            )}
          >
            {Icon && <Icon />}
            <span>{label}</span>
            <ChevronRight
              className={cn(
                chevronClass,
                "group-data-[state=open]/collapsible:rotate-90"
              )}
            />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub className={subListClass}>
            {items.map((item) => (
              <NavSubItem key={item.title} item={item} />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

function NavSubItem({ item }: { item: navItemType }) {
  const { pathname, isActive, href } = useNav();
  const router = useRouter();

  const childActive =
    item.items?.some((sub) => pathname.startsWith(sub.url)) ?? false;
  // Opens whenever navigation lands on one of its pages; adjusted during render.
  const [open, setOpen] = useState(childActive);
  const [wasActive, setWasActive] = useState(childActive);
  if (childActive !== wasActive) {
    setWasActive(childActive);
    if (childActive) setOpen(true);
  }

  if (!item.items) {
    return (
      <SidebarMenuSubItem>
        <SidebarMenuSubButton
          asChild
          isActive={isActive(item.url)}
          className={subRowClass}
        >
          <Link href={href(item.url)}>
            {item.icon && (
              <item.icon className={childIconClass(isActive(item.url))} />
            )}
            <span>{item.title}</span>
          </Link>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    );
  }

  return (
    <Collapsible
      asChild
      open={open}
      onOpenChange={setOpen}
      className="group/sub"
    >
      <SidebarMenuSubItem>
        <CollapsibleTrigger
          asChild
          onClick={() => {
            const first = item.items?.[0]?.url;
            if (first && !childActive) router.push(href(first));
          }}
        >
          <SidebarMenuSubButton
            asChild
            className={cn(subRowClass, childActive && "text-foreground")}
          >
            <button type="button" className="w-full">
              {item.icon && (
                <item.icon className={childIconClass(childActive)} />
              )}
              <span>{item.title}</span>
              <ChevronRight
                className={cn(
                  chevronClass,
                  "group-data-[state=open]/sub:rotate-90"
                )}
              />
            </button>
          </SidebarMenuSubButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub className="mx-0 gap-0.5 border-l-0 px-0 pl-3 py-0.5">
            {item.items.map((sub) => (
              <SidebarMenuSubItem key={sub.title}>
                <SidebarMenuSubButton
                  asChild
                  isActive={isActive(sub.url)}
                  className={subRowClass}
                >
                  <Link href={href(sub.url)}>
                    {sub.icon && (
                      <sub.icon className={childIconClass(isActive(sub.url))} />
                    )}
                    <span>{sub.title}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuSubItem>
    </Collapsible>
  );
}

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
    icon?: LucideIcon | ComponentType<SVGProps<SVGSVGElement>>;
  }[];
}
