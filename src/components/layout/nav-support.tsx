"use client";

import { MessageCircleQuestionMark } from "lucide-react";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

import { useChatwoot } from "@/context/useChatwoot";
import { CHATWOOT_ENABLED } from "@/lib/integrations";

// Rendered in the sidebar footer (next to the user menu) rather than as its own
// labeled section — a single-item "Support" header read as heavy.
export function NavSupport() {
  const { toggleChat } = useChatwoot();
  if (!CHATWOOT_ENABLED) return null;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          onClick={() => toggleChat()}
          asChild
          tooltip={"Live Support"}
        >
          <div className={"cursor-pointer"}>
            <div className="relative">
              <MessageCircleQuestionMark className="size-4" />
              <div className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-emerald-500 ring-2 ring-sidebar" />
            </div>
            <span>Live Support</span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
