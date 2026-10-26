"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Maximize2, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";

const KEY = "journeys.mapZoom";
const MIN = 0.3;

const stored = () => {
  try {
    const n = Number(sessionStorage.getItem(KEY));
    return n >= MIN && n <= 1 ? n : 1;
  } catch {
    return 1;
  }
};

// The map at a CSS scale; the sizer keeps the scroll area as large as the scaled map.
export default function MapViewport({
  notice,
  onKeyDown,
  onBackground,
  autoFit,
  children,
}: {
  notice?: ReactNode;
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
  // A click on the empty canvas.
  onBackground?: () => void;
  // On open, shrink to fit when the map is wider than the canvas.
  autoFit?: boolean;
  children: ReactNode;
}) {
  const [scale, setScale] = useState(stored);
  const [size, setSize] = useState({ w: 0, h: 0, view: 0 });
  const scroller = useRef<HTMLDivElement>(null);
  const fitted = useRef(false);
  const inner = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = inner.current;
    const box = scroller.current;
    if (!el || !box) return;
    const measure = () => {
      setSize({ w: el.offsetWidth, h: el.offsetHeight, view: box.clientWidth });
      const content = el.querySelector<HTMLElement>("[data-map-content]");
      if (!autoFit || fitted.current || !box.clientWidth || !content) return;
      fitted.current = true;
      const needed = content.offsetWidth + 64;
      setScale((now) =>
        needed * now > box.clientWidth
          ? Math.max(MIN, Math.floor((box.clientWidth / needed) * 100) / 100)
          : now
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    observer.observe(box);
    return () => observer.disconnect();
  }, [autoFit]);

  const zoom = useCallback((next: number) => {
    const value = Math.round(Math.min(1, Math.max(MIN, next)) * 100) / 100;
    setScale(value);
    try {
      sessionStorage.setItem(KEY, String(value));
    } catch {}
  }, []);

  const fit = () => {
    const content =
      inner.current?.querySelector<HTMLElement>("[data-map-content]");
    const view = scroller.current?.clientWidth ?? 0;
    if (!content || !view) return;
    zoom((view - 32) / content.offsetWidth);
  };

  const measured = size.w > 0;
  return (
    // Inline-size containment keeps the scaled map from widening the page around it.
    <div className="relative min-h-0 min-w-0 flex-1 [contain:inline-size]">
      <div
        ref={scroller}
        data-journey-map
        onKeyDown={onKeyDown}
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest("button, a, [role=menu]"))
            onBackground?.();
        }}
        className="h-full overflow-auto bg-sidebar [background-image:radial-gradient(color-mix(in_oklab,var(--muted-foreground)_22%,transparent)_1px,transparent_1px)] [background-size:18px_18px]"
      >
        {notice}
        <div
          style={
            measured
              ? { width: size.w * scale, height: size.h * scale }
              : undefined
          }
        >
          <div
            ref={inner}
            className="w-max origin-top-left"
            style={{
              transform: `scale(${scale})`,
              minWidth: size.view ? size.view / scale : undefined,
            }}
          >
            {children}
          </div>
        </div>
      </div>
      <div
        role="group"
        aria-label="Map zoom"
        className="absolute bottom-3 left-3 z-20 flex items-center gap-0.5 rounded-lg border border-sidebar-border bg-background p-0.5 shadow-xs"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="Zoom out"
          disabled={scale <= MIN}
          onClick={() => zoom(scale - 0.1)}
        >
          <Minus className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs tabular-nums"
          aria-label="Reset zoom"
          onClick={() => zoom(1)}
        >
          {Math.round(scale * 100)}%
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="Fit to screen"
          onClick={fit}
        >
          <Maximize2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
