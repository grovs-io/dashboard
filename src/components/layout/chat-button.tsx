"use client";

import { MessageCircle } from "lucide-react";

import { useChatwoot } from "@/context/useChatwoot";
import { CHATWOOT_ENABLED } from "@/lib/integrations";

export function ChatButton() {
  if (!CHATWOOT_ENABLED) return null;
  return <LabelButton />;
}

function LabelButton() {
  const { toggleChat } = useChatwoot();
  return (
    <button
      type="button"
      onClick={() => toggleChat()}
      className="inline-flex h-9 items-center gap-2 rounded-md border-none bg-secondary px-3 text-sm text-secondary-foreground shadow-none transition-colors hover:bg-secondary/80"
    >
      <MessageCircle className="w-4 h-4" />
      Live chat
    </button>
  );
}
