"use client";
import { useEffect, useRef, useState } from "react";
import { Monitor, Moon, Smartphone, Sun, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  showErrorNotification,
  showInfoNotification,
} from "@/lib/Notifications";
import {
  LANDSCAPE_SAFE,
  LandscapeIsland,
  SCREENS,
  type PreviewDevice,
} from "@/components/composer/DeviceFrame";
import { config } from "@/lib/config";
import { cn } from "@/lib/utils";
import { linkAllowed, normaliseLink } from "@ee/lib/inAppLinkRule";
import type { InAppLayout } from "@ee/types/inApp";

// The page that runs the real bridge.js; it lives on the API origin under its own CSP.
export const previewUrl = () =>
  new URL(
    "/in_app/preview",
    config.apiUrl ||
      (typeof window === "undefined"
        ? "http://localhost"
        : window.location.origin)
  ).toString();

// Who the preview shows the message to.
export const SAMPLE_USER = {
  first_name: "Alex",
  last_name: "Morgan",
  email: "alex@example.com",
  plan: "pro",
};

export { SCREENS };
export type Device = PreviewDevice;
type Scheme = "light" | "dark";

const DEVICES: { device: Device; label: string }[] = [
  { device: "phone", label: "Phone" },
  { device: "landscape", label: "Phone landscape" },
  { device: "web", label: "Browser" },
];
const BAR = 44;
const PHONE_STATUS_BAR = 47;

interface Entry {
  key: number;
  text: string;
  detail?: string;
}

interface Bridge {
  v: number;
  id: string;
  type: string;
  args?: Record<string, unknown>;
}

interface Shown {
  ready: boolean;
  missing: boolean;
  height: number;
  closed: boolean;
  // Not shown within the SDK's 5 s deadline.
  late: boolean;
}

const fresh: Shown = {
  ready: false,
  missing: false,
  height: 0,
  closed: false,
  late: false,
};

const DEADLINE = 5000;
const LOAD_LIMIT = 10000;

// The web SDK's checks on track and setAttribute.
const isName = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= 100;
const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isAttribute = (v: unknown) =>
  v === null ||
  typeof v === "string" ||
  typeof v === "boolean" ||
  (typeof v === "number" && Number.isFinite(v));

const visibleIn = (s: Shown, layout: InAppLayout) =>
  s.ready && !s.missing && (layout === "full" || s.height > 0);

// Where the SDK puts the message for each layout, in the screen's own points.
export function messageBox(
  layout: InAppLayout,
  height: number,
  device: Device
) {
  const screen = SCREENS[device];
  if (layout === "full")
    return { left: 0, top: 0, width: screen.width, height: screen.height };
  // On its side the phone's safe area loses the island side, its mirror and the home indicator.
  const side = device === "landscape" ? LANDSCAPE_SAFE.side : 0;
  const safe = {
    width: screen.width - side * 2,
    height:
      screen.height - (device === "landscape" ? LANDSCAPE_SAFE.bottom : 0),
  };
  if (layout === "modal") {
    const width = Math.min(420, safe.width - 32);
    // Until measured, the largest: a page that fills its frame then shows full size instead of collapsing.
    const tall = Math.min(height || Infinity, safe.height * 0.9);
    return {
      left: side + (safe.width - width) / 2,
      top: (safe.height - tall) / 2,
      width,
      height: tall,
    };
  }
  // As the SDKs: a screen under 500 points tall gives a banner 45%, not 30%.
  const tall = Math.min(
    height || Infinity,
    safe.height * (safe.height < 500 ? 0.45 : 0.3)
  );
  // On a phone the SDK starts a top banner below the status bar.
  const below = device === "phone" ? PHONE_STATUS_BAR : 0;
  return {
    left: 0,
    top: layout === "banner_top" ? below : screen.height - tall,
    width: screen.width,
    height: tall,
  };
}

const segment = (on: boolean) =>
  cn(
    "flex h-7 w-9 items-center justify-center rounded-md transition-colors",
    on
      ? "bg-accent text-primary"
      : "text-muted-foreground hover:text-foreground"
  );

export default function HtmlPreview({
  html,
  layout,
  dismissible,
  backdrop,
  maxWidth = 270,
  maxHeight = 480,
}: {
  html: string;
  layout: InAppLayout;
  dismissible: boolean;
  backdrop: "dim" | "none";
  maxWidth?: number;
  maxHeight?: number;
}) {
  const url = previewUrl();
  const origin = new URL(url).origin;
  const frame = useRef<HTMLIFrameElement>(null);
  const loaded = useRef(false);
  const [failed, setFailed] = useState(false);
  // Each render has its own number, so calls from an earlier page are dropped.
  const seq = useRef(0);
  const deadline = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [device, setDevice] = useState<Device>("phone");
  const [scheme, setScheme] = useState<Scheme>("light");
  const [shown, setShown] = useState<Shown>(fresh);
  const [log, setLog] = useState<Entry[]>([]);
  const counter = useRef(0);
  const latest = useRef({ html, layout, scheme });
  useEffect(() => {
    latest.current = { html, layout, scheme };
  });

  const post = (message: unknown) =>
    frame.current?.contentWindow?.postMessage(message, origin);

  const render = (over: Partial<typeof latest.current> = {}) => {
    if (!loaded.current) return;
    const next = { ...latest.current, ...over };
    seq.current += 1;
    setShown(fresh);
    clearTimeout(deadline.current);
    deadline.current = setTimeout(
      () =>
        setShown((s) =>
          visibleIn(s, latest.current.layout) ? s : { ...s, late: true }
        ),
      DEADLINE
    );
    post({
      type: "render",
      seq: seq.current,
      html: next.html,
      user: SAMPLE_USER,
      event: {},
      capabilities: { pushPermission: "prompt" },
      layout: next.layout,
      colorScheme: next.scheme,
    });
  };

  // Typing re-renders once it pauses, not on every key; the first render waits for the page's hello.
  const started = useRef(false);
  useEffect(() => {
    if (!started.current) {
      started.current = true;
      return;
    }
    const timer = setTimeout(() => render(), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, layout]);

  // A closed or late message is torn down, as the SDK does, so its media and scripts stop.
  const gone = shown.closed || shown.late;
  useEffect(() => {
    if (!gone) return;
    seq.current += 1;
    frame.current?.contentWindow?.postMessage(
      {
        type: "render",
        seq: seq.current,
        html: "",
        user: SAMPLE_USER,
        event: {},
        capabilities: { pushPermission: "prompt" },
        layout: latest.current.layout,
        colorScheme: latest.current.scheme,
      },
      origin
    );
  }, [gone, origin]);

  useEffect(() => {
    const timer = setTimeout(
      () => !loaded.current && setFailed(true),
      LOAD_LIMIT
    );
    return () => {
      clearTimeout(timer);
      clearTimeout(deadline.current);
    };
  }, []);

  const note = (
    text: string,
    detail?: string,
    error = false,
    quiet = false
  ) => {
    if (error) showErrorNotification(text);
    else if (!quiet) showInfoNotification(text);
    counter.current += 1;
    const key = counter.current;
    setLog((entries) => [{ key, text, detail }, ...entries].slice(0, 50));
  };

  const handle = (message: Bridge) => {
    const args = message.args ?? {};
    const reply = (body: Record<string, unknown>) =>
      post({
        type: "reply",
        seq: seq.current,
        message: { v: 1, id: message.id, ...body },
      });
    // As the apps do: calls before the message shows are dropped.
    const visible = visibleIn(shown, latest.current.layout);
    if (message.type === "requestPushPermission" && !visible)
      return reply({ ok: false, error: "not_shown" });
    if (
      ["close", "track", "open", "setAttribute"].includes(message.type) &&
      !visible
    )
      return;
    switch (message.type) {
      // After the deadline the SDK has torn the message down; late calls change nothing.
      case "ready":
        return setShown((s) =>
          s.late ? s : { ...s, ready: true, missing: !!args.missing }
        );
      case "height":
        return setShown((s) =>
          s.late ? s : { ...s, height: Number(args.value) || 0 }
        );
      case "close":
        note("Closed");
        return setShown((s) => ({ ...s, closed: true }));
      case "track": {
        const { name, properties = {} } = args;
        if (!isName(name) || !isObject(properties))
          return note("Refused track: invalid name", undefined, true);
        return note(
          `Tracked "${name}"`,
          Object.keys(properties).length
            ? JSON.stringify(properties)
            : undefined,
          false,
          true
        );
      }
      case "open": {
        const link = String(args.url ?? "");
        if (!linkAllowed(link))
          return note(`Not allowed to open ${link}`, undefined, true);
        if (args.active === false)
          return note("Ignored: open without a tap", link, true);
        // The apps ignore a fragment; bridge.js scrolls to it itself.
        if (normaliseLink(link).startsWith("#")) return;
        note(`Opened ${link}`);
        return setShown((s) => ({ ...s, closed: true }));
      }
      case "setAttribute": {
        const { key, value } = args;
        if (!isName(key) || !isAttribute(value))
          return note(`Refused attribute: ${String(key)}`, undefined, true);
        return note(
          `Set ${key} to ${JSON.stringify(value)}`,
          undefined,
          false,
          true
        );
      }
      case "requestPushPermission":
        note("Asked for push permission");
        return reply({ ok: true, result: "granted" });
    }
  };
  // The page's own hello: a frame blocked by its CSP still fires onLoad but never says it.
  const hello = () => {
    loaded.current = true;
    setFailed(false);
    render();
  };
  const handler = useRef({ handle, hello });
  useEffect(() => {
    handler.current = { handle, hello };
  });

  useEffect(() => {
    const listen = (e: MessageEvent) => {
      const data = e.data as {
        type?: string;
        seq?: number;
        message?: Bridge;
      } | null;
      if (e.source !== frame.current?.contentWindow || e.origin !== origin)
        return;
      if (data?.type === "hello") return handler.current.hello();
      if (data?.type !== "bridge" || data.seq !== seq.current) return;
      if (data.message?.v !== 1) return;
      handler.current.handle(data.message);
    };
    window.addEventListener("message", listen);
    return () => window.removeEventListener("message", listen);
  }, [origin]);

  const screen = SCREENS[device];
  const web = device === "web";
  // A frame scaled to nothing is throttled by the browser and never reports its height.
  const scale = Math.min(
    (maxWidth > 0 ? maxWidth : 270) / screen.width,
    (maxHeight > 0 ? maxHeight : 480) / (screen.height + (web ? BAR : 0))
  );
  const empty = !html.trim();
  const visible = !empty && !shown.late && visibleIn(shown, layout);
  const place = messageBox(layout, shown.height, device);
  const dark = scheme === "dark";

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="flex w-full items-center justify-between">
        <div
          role="radiogroup"
          aria-label="Preview on"
          className="inline-flex rounded-lg border border-sidebar-border bg-background p-0.5"
        >
          {DEVICES.map(({ device: item, label }) => (
            <button
              key={item}
              type="button"
              role="radio"
              aria-checked={device === item}
              aria-label={label}
              title={label}
              onClick={() => setDevice(item)}
              className={segment(device === item)}
            >
              {item === "web" ? (
                <Monitor className="size-4" />
              ) : (
                <Smartphone
                  className={cn("size-4", item === "landscape" && "rotate-90")}
                />
              )}
            </button>
          ))}
        </div>
        <div
          role="radiogroup"
          aria-label="Appearance"
          className="inline-flex rounded-lg border border-sidebar-border bg-background p-0.5"
        >
          {(["light", "dark"] as const).map((item) => (
            <button
              key={item}
              type="button"
              role="radio"
              aria-checked={scheme === item}
              aria-label={item === "dark" ? "Dark" : "Light"}
              title={item === "dark" ? "Dark" : "Light"}
              onClick={() => {
                setScheme(item);
                render({ scheme: item });
              }}
              className={segment(scheme === item)}
            >
              {item === "dark" ? (
                <Moon className="size-4" />
              ) : (
                <Sun className="size-4" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          width: screen.width * scale,
          height: (screen.height + (web ? BAR : 0)) * scale,
        }}
        className={cn(
          "relative box-content shrink-0 overflow-hidden border-[#1B1F27] shadow-sm",
          web ? "rounded-lg border" : "rounded-[22px] border-4"
        )}
      >
        <div
          style={{
            width: screen.width,
            height: screen.height + (web ? BAR : 0),
            transform: `scale(${scale})`,
          }}
          className="absolute left-0 top-0 origin-top-left"
        >
          {web && (
            <div
              aria-hidden="true"
              style={{ height: BAR }}
              className="flex items-center gap-2 border-b border-[#D5DBE3] bg-white px-4"
            >
              <span className="size-3 rounded-full bg-[#D5DBE3]" />
              <span className="size-3 rounded-full bg-[#D5DBE3]" />
              <span className="size-3 rounded-full bg-[#D5DBE3]" />
              <span className="ml-4 h-6 flex-1 rounded-full bg-[#EEF1F5]" />
            </div>
          )}
          <div
            style={{ width: screen.width, height: screen.height }}
            className={cn("relative", dark ? "bg-[#111827]" : "bg-[#F3F5F8]")}
          >
            {visible && !shown.closed && layout === "modal" && (
              <div
                aria-hidden="true"
                onClick={() => {
                  if (!dismissible) return;
                  note("Closed by a tap outside");
                  setShown((s) => ({ ...s, closed: true }));
                }}
                className={cn(
                  "absolute inset-0",
                  backdrop === "dim" && "bg-black/40"
                )}
              />
            )}
            <iframe
              ref={frame}
              title="Message preview"
              src={url}
              sandbox="allow-scripts allow-same-origin"
              allow="autoplay; fullscreen"
              style={{ ...place, colorScheme: scheme }}
              className={cn(
                "absolute border-0 bg-transparent",
                layout === "modal" && "rounded-2xl",
                (!visible || shown.closed) && "pointer-events-none opacity-0"
              )}
            />
            {visible && !shown.closed && (
              <button
                type="button"
                aria-label="Close"
                onClick={() => {
                  note("Closed");
                  setShown((s) => ({ ...s, closed: true }));
                }}
                style={{
                  left: place.left + place.width - 48,
                  top: place.top + 4,
                }}
                className="absolute flex size-11 items-center justify-center"
              >
                <span className="flex size-7 items-center justify-center rounded-full bg-black/45 text-white">
                  <X className="size-4" />
                </span>
              </button>
            )}
            {device === "landscape" && <LandscapeIsland />}
            {empty && (
              <p
                style={{ fontSize: web ? 28 : 22 }}
                className={cn(
                  "absolute inset-0 flex items-center justify-center p-10 text-center",
                  dark ? "text-[#9CA3AF]" : "text-[#6B7280]"
                )}
              >
                Pick an example or start blank, and your message shows here.
              </p>
            )}
          </div>
        </div>
      </div>

      {shown.missing && (
        <p className="text-center text-xs text-destructive">
          A field has no value and no default, so the app would skip this
          message.
        </p>
      )}
      {shown.closed && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => render()}
        >
          Show again
        </Button>
      )}
      {shown.late && (
        <p className="text-center text-xs text-destructive">
          The app would skip this message: it was not ready within 5 s.
        </p>
      )}
      {failed ? (
        <p className="text-center text-xs text-destructive">
          The preview could not load from {origin}. Check that the API is
          reachable.
        </p>
      ) : (
        !empty &&
        !shown.ready &&
        !shown.late && (
          <p className="text-center text-xs text-muted-foreground">
            Loading the preview…
          </p>
        )
      )}
      <p className="text-center text-xs text-muted-foreground">
        Shown to a sample person, {SAMPLE_USER.first_name}. The app always draws
        its own close button.
      </p>

      <div className="w-full space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium">What the message did</p>
          {log.length > 0 && (
            <button
              type="button"
              onClick={() => setLog([])}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
        <ol
          role="log"
          aria-label="What the message did"
          className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-sidebar-border bg-background p-2 text-xs"
        >
          {log.length === 0 && (
            <li className="text-muted-foreground">
              Taps that close, open, track or ask show here. Nothing is sent.
            </li>
          )}
          {log.map((entry) => (
            <li key={entry.key} className="[overflow-wrap:anywhere]">
              {entry.text}
              {entry.detail && (
                <span className="block font-mono text-muted-foreground">
                  {entry.detail}
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
