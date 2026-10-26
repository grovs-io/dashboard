"use client";
import { ChevronDown, SquareCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SAMPLE_VIDEO_URL } from "@ee/lib/inAppHtmlGallery";

export interface Snippet {
  label: string;
  hint: string;
  html: string;
}

// No close-X snippet: the app always draws its own close button.
export const SNIPPETS: Snippet[] = [
  {
    label: "“No thanks” button",
    hint: "Closes the message",
    html: `<button type="button" data-grovs-action="close" data-grovs-edit="Dismiss button">No thanks</button>`,
  },
  {
    label: "Tracked button",
    hint: "Records an event; the first counts as the click",
    html: `<button type="button" data-grovs-action="track" data-grovs-event="button_tapped" data-grovs-edit="Tracked button">Tap me</button>`,
  },
  {
    label: "Open a link",
    hint: "Opens a web or app link, then closes",
    html: `<button type="button" data-grovs-action="open" data-grovs-url="https://example.com" data-grovs-edit="Link button">Learn more</button>`,
  },
  {
    label: "Push permission button",
    hint: "Asks to send notifications; hidden when the app can't ask",
    html: `<button type="button" data-grovs-edit="Allow button">Turn on notifications</button>
<script>
  (function () {
    var button = document.currentScript.previousElementSibling;
    if (grovs.capabilities.pushPermission !== "prompt") {
      button.hidden = true;
      return;
    }
    button.addEventListener("click", function () {
      grovs.requestPushPermission().catch(function () {}).then(function () {
        grovs.close();
      });
    });
  })();
</script>`,
  },
  {
    label: "Sized video",
    hint: "Plays muted and inline, without making the message jump",
    html: `<video src="${SAMPLE_VIDEO_URL}" width="960" height="540" style="display: block; width: 100%; height: auto;" autoplay muted loop playsinline data-grovs-edit="Video: replace with your own"></video>`,
  },
  {
    label: "Editable text",
    hint: "Shows up in quick edit",
    html: `<p data-grovs-edit="Text">Write something here.</p>`,
  },
  {
    label: "Personalized text",
    hint: "Fills in the person's first name",
    html: `<p>Hi {{ user.first_name | default: "there" }}!</p>`,
  },
];

export default function Snippets({
  onInsert,
}: {
  onInsert: (html: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          aria-label="Insert a snippet"
        >
          <SquareCode className="size-3.5" />
          Snippets
          <ChevronDown className="size-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-72"
        // The cursor stays in the editor, where the snippet went.
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Inserted where the cursor is
        </DropdownMenuLabel>
        {SNIPPETS.map((snippet) => (
          <DropdownMenuItem
            key={snippet.label}
            onSelect={() => onInsert(snippet.html)}
            className="flex-col items-start gap-0"
          >
            <span className="text-[13px]">{snippet.label}</span>
            <span className="text-xs text-muted-foreground">
              {snippet.hint}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
