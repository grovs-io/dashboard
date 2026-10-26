"use client";
import { useRef, useState, type ReactNode } from "react";
import { BookOpen, Copy, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { handleCopyText } from "@/lib/copyTextHelper";

interface Example {
  code: string;
  hint?: string;
}

interface Part {
  title: string;
  text?: ReactNode;
  examples?: Example[];
  notes?: ReactNode[];
}

const code = (text: string) => (
  <code className="rounded bg-muted px-1 font-mono text-[11px]">{text}</code>
);

const PARTS: Part[] = [
  {
    title: "Buttons without code",
    text: "Put an action on any element.",
    examples: [
      {
        code: '<button type="button" data-grovs-action="close">No thanks</button>',
      },
      {
        code: '<button type="button" data-grovs-action="open" data-grovs-url="https://example.com">Learn more</button>',
      },
      {
        code: '<button type="button" data-grovs-action="track" data-grovs-event="button_tapped">Tap me</button>',
      },
    ],
  },
  {
    title: "Personalize",
    text: "Fills text, and the alt, title, aria-* and data-* attributes. For links and scripts, read the person from grovs.user.",
    examples: [
      { code: '{{ user.first_name | default: "there" }}' },
      { code: "grovs.user.first_name" },
    ],
  },
  {
    title: "JavaScript",
    examples: [
      { code: "grovs.close()", hint: "Closes the message" },
      {
        code: 'grovs.track("name", { plan: "pro" })',
        hint: "Records an event",
      },
      { code: 'grovs.open("https://example.com")', hint: "Opens, then closes" },
      {
        code: 'grovs.setAttribute("key", "value")',
        hint: "Sets an attribute of the person",
      },
      {
        code: "grovs.requestPushPermission()",
        hint: 'Asks for notifications; resolves to "granted", "denied" or "unsupported"',
      },
      {
        code: "grovs.capabilities.pushPermission",
        hint: '"prompt" while the app can still ask',
      },
    ],
  },
  {
    title: "Links and media",
    notes: [
      <>
        Load everything over https. While developing, http from localhost and
        other local hosts works too.
      </>,
      <>
        A link to {code("#id")} scrolls in place; other links open and close the
        message.
      </>,
      <>
        Give images and videos a width and height so the message does not jump.
      </>,
    ],
    examples: [
      { code: '<a href="#details">See details</a>' },
      {
        code: '<img src="https://example.com/a.png" alt="" width="600" height="400" style="max-width:100%;height:auto">',
      },
    ],
  },
  {
    title: "Good to know",
    notes: [
      <>The app always draws its own close button on top.</>,
      <>The first track or open counts as the click, once per view.</>,
      <>The HTML can be up to 64 KB.</>,
      <>
        Don&apos;t put {code("{{ }}")} in a data-* attribute a script uses as a
        URL; build it from {code("grovs.user")}.
      </>,
    ],
  },
];

export default function HowItWorks({
  onInsert,
}: {
  onInsert: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  // After an insert the editor keeps focus; the button that opened this must not take it back.
  const inserted = useRef(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8"
        onClick={() => setOpen(true)}
      >
        <BookOpen className="size-4" />
        How it works
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          className="w-full gap-0 overflow-y-auto sm:max-w-md"
          onCloseAutoFocus={(e) => {
            if (inserted.current) e.preventDefault();
            inserted.current = false;
          }}
        >
          <SheetHeader className="border-b border-sidebar-border">
            <SheetTitle>How it works</SheetTitle>
            <SheetDescription>
              The few things a message needs to talk to the app.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-6 p-4">
            {PARTS.map((part) => (
              <section key={part.title} className="space-y-2">
                <h3 className="text-[13px] font-semibold">{part.title}</h3>
                {part.text && (
                  <p className="text-xs text-muted-foreground">{part.text}</p>
                )}
                {part.notes && (
                  <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                    {part.notes.map((note, i) => (
                      <li key={i}>{note}</li>
                    ))}
                  </ul>
                )}
                {part.examples && (
                  <ul className="space-y-1.5">
                    {part.examples.map((example) => (
                      <li
                        key={example.code}
                        className="rounded-lg border border-sidebar-border p-2"
                      >
                        <div className="flex items-start gap-2">
                          <code className="min-w-0 flex-1 font-mono text-[11px] [overflow-wrap:anywhere]">
                            {example.code}
                          </code>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1.5 text-xs"
                            onClick={() => handleCopyText(example.code)}
                          >
                            <Copy className="size-3" />
                            Copy
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1.5 text-xs"
                            onClick={() => {
                              inserted.current = true;
                              setOpen(false);
                              onInsert(example.code);
                            }}
                          >
                            <Plus className="size-3" />
                            Insert
                          </Button>
                        </div>
                        {example.hint && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {example.hint}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
