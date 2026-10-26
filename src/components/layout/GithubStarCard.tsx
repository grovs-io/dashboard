"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  localDay,
  markDone,
  readStarState,
  recordVisit,
  shouldAsk,
  snooze,
  writeStarState,
  type StarState,
} from "@/lib/githubStar";

export const REPO_URL = "https://github.com/grovs-io/backend";
export const ASK_DELAY_MS = 1500;

function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className}>
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.71 1.22 1.87.87 2.33.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8z"
      />
    </svg>
  );
}

export default function GithubStarCard() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const asked = useRef(false);

  useEffect(() => {
    const state = readStarState();
    if (!state) return;
    const next = recordVisit(state, localDay(new Date()));
    if (next !== state) writeStarState(next);
  }, []);

  useEffect(() => {
    if (asked.current) return;
    const timer = setTimeout(() => {
      // Never over an open dialog; the next page change tries again.
      if (document.querySelector('[role="dialog"], [role="alertdialog"]'))
        return;
      const state = readStarState();
      if (!state || !shouldAsk(state, Date.now())) return;
      asked.current = true;
      writeStarState({ ...state, asks: state.asks + 1 });
      setOpen(true);
    }, ASK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [pathname]);

  const close = (update: (state: StarState) => StarState) => {
    const state = readStarState();
    if (state) writeStarState(update(state));
    setOpen(false);
  };

  if (!open) return null;

  return (
    <aside
      aria-label="Star Grovs on GitHub"
      className="fixed right-4 bottom-4 left-4 z-40 rounded-xl border bg-popover py-3.5 pr-3.5 pl-4 text-popover-foreground shadow-lg animate-in fade-in-0 slide-in-from-bottom-2 duration-300 sm:left-auto sm:w-[272px]"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={() => close((s) => snooze(s, Date.now()))}
        className="absolute top-2 right-2 grid size-[22px] place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <X className="size-3" />
      </button>
      <div className="mb-[5px] flex items-center gap-2 text-[13px] font-semibold tracking-[-0.005em]">
        <GithubMark className="size-4 shrink-0" />
        Enjoying Grovs?
      </div>
      <p className="mb-3 pr-2 text-xs leading-[1.45] text-muted-foreground">
        We&apos;re open source. A star on GitHub helps other developers find us.
      </p>
      <div className="flex gap-2">
        <Button asChild size="sm" className="flex-1">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => close(markDone)}
          >
            <Star className="size-3 fill-current" />
            Star on GitHub
          </a>
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="px-3.5"
          onClick={() => close((s) => snooze(s, Date.now()))}
        >
          Later
        </Button>
      </div>
    </aside>
  );
}
