import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import HtmlPreview, {
  messageBox,
  previewUrl,
  SAMPLE_USER,
} from "../html/HtmlPreview";

const { showErrorNotification, showInfoNotification } = vi.hoisted(() => ({
  showErrorNotification: vi.fn(),
  showInfoNotification: vi.fn(),
}));
vi.mock("@/lib/Notifications", () => ({
  showErrorNotification,
  showInfoNotification,
}));
vi.mock("@/lib/config", () => ({
  config: { apiUrl: "https://api.grovs.example/api" },
}));

const origin = "https://api.grovs.example";

function open(html = "<p>Hi</p>") {
  render(
    <HtmlPreview
      html={html}
      layout="modal"
      dismissible
      backdrop="dim"
      maxWidth={270}
      maxHeight={480}
    />
  );
  const frame = screen.getByTitle("Message preview") as HTMLIFrameElement;
  const post = vi.spyOn(frame.contentWindow!, "postMessage");
  hello(frame);
  return { frame, post };
}

const hello = (frame: HTMLIFrameElement) =>
  act(() => {
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "hello" },
        origin,
        source: frame.contentWindow,
      })
    );
  });

const fromPreview = (
  frame: HTMLIFrameElement,
  message: Record<string, unknown>,
  { from = origin, seq = 1, source = frame.contentWindow as Window | null } = {}
) =>
  act(() => {
    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "bridge",
          seq,
          message: { v: 1, token: "t", ...message },
        },
        origin: from,
        source,
      })
    );
  });

// Ready with a height: the message is on screen.
const show = (frame: HTMLIFrameElement, seq = 1) => {
  fromPreview(
    frame,
    { id: "r", type: "ready", args: { missing: false } },
    { seq }
  );
  fromPreview(
    frame,
    { id: "h", type: "height", args: { value: 200 } },
    { seq }
  );
};

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.useRealTimers());

describe("HtmlPreview", () => {
  it("loads the preview page from the API origin", () => {
    expect(previewUrl()).toBe(`${origin}/in_app/preview`);
    const { frame } = open();
    expect(frame.getAttribute("src")).toBe(`${origin}/in_app/preview`);
  });

  it("sends the draft to render once the page says hello", () => {
    const { post } = open("<h1>{{ user.first_name }}</h1>");
    expect(post).toHaveBeenCalledWith(
      {
        type: "render",
        seq: 1,
        html: "<h1>{{ user.first_name }}</h1>",
        user: SAMPLE_USER,
        event: {},
        capabilities: { pushPermission: "prompt" },
        layout: "modal",
        colorScheme: "light",
      },
      origin
    );
  });

  it("logs a track call without a toast", () => {
    const { frame } = open();
    show(frame);
    fromPreview(frame, {
      id: "1",
      type: "track",
      args: { name: "liked", properties: { stars: 5 } },
    });
    expect(showInfoNotification).not.toHaveBeenCalled();
    expect(showErrorNotification).not.toHaveBeenCalled();
    expect(screen.getByRole("log")).toHaveTextContent('Tracked "liked"');
    expect(screen.getByRole("log")).toHaveTextContent('{"stars":5}');
  });

  it("ignores messages from anywhere else", () => {
    const { frame } = open();
    fromPreview(
      frame,
      { id: "1", type: "track", args: { name: "x" } },
      { from: "https://evil.example" }
    );
    expect(showInfoNotification).not.toHaveBeenCalled();
    expect(showErrorNotification).not.toHaveBeenCalled();
  });

  it("ignores a message from the API origin but another window", () => {
    const { frame } = open();
    fromPreview(
      frame,
      { id: "1", type: "track", args: { name: "x" } },
      { source: window }
    );
    expect(showInfoNotification).not.toHaveBeenCalled();
    expect(showErrorNotification).not.toHaveBeenCalled();
  });

  it("ignores calls from an earlier render", () => {
    const { frame } = open();
    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
    show(frame, 2);
    fromPreview(frame, { id: "1", type: "track", args: { name: "old" } });
    expect(screen.getByRole("log")).not.toHaveTextContent("old");
    fromPreview(
      frame,
      { id: "2", type: "track", args: { name: "new" } },
      { seq: 2 }
    );
    expect(screen.getByRole("log")).toHaveTextContent('Tracked "new"');
  });

  it("refuses a link the rule does not allow, without going anywhere", () => {
    const { frame } = open();
    const before = window.location.href;
    fromPreview(frame, { id: "1", type: "ready", args: { missing: false } });
    fromPreview(frame, { id: "2", type: "height", args: { value: 200 } });
    fromPreview(frame, {
      id: "3",
      type: "open",
      args: { url: "javascript:alert(1)" },
    });
    expect(showErrorNotification).toHaveBeenCalledWith(
      "Not allowed to open javascript:alert(1)"
    );
    expect(showInfoNotification).not.toHaveBeenCalled();
    expect(window.location.href).toBe(before);
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("says the app would skip a message not ready within 5 s", () => {
    vi.useFakeTimers();
    const { frame, post } = open();
    act(() => vi.advanceTimersByTime(5000));
    expect(
      screen.getByText(
        "The app would skip this message: it was not ready within 5 s."
      )
    ).toBeInTheDocument();
    expect(post).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "render", seq: 2, html: "" }),
      origin
    );
    fromPreview(frame, { id: "1", type: "ready", args: { missing: false } });
    fromPreview(frame, { id: "2", type: "height", args: { value: 200 } });
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  });

  it("asks for a design instead of a blank phone when there is no HTML", () => {
    render(<HtmlPreview html="" layout="full" dismissible backdrop="dim" />);
    expect(
      screen.getByText(/Pick an example or start blank/)
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    expect(screen.queryByText("Loading the preview…")).toBeNull();
  });

  it("says so when the preview page never loads", () => {
    vi.useFakeTimers();
    render(
      <HtmlPreview html="<p>Hi</p>" layout="modal" dismissible backdrop="dim" />
    );
    act(() => vi.advanceTimersByTime(10000));
    expect(screen.getByText(/The preview could not load/)).toBeInTheDocument();
  });

  it("blames the preview page, not the HTML, when the frame loads without saying hello", () => {
    vi.useFakeTimers();
    render(
      <HtmlPreview html="<p>Hi</p>" layout="modal" dismissible backdrop="dim" />
    );
    const frame = screen.getByTitle("Message preview") as HTMLIFrameElement;
    const post = vi.spyOn(frame.contentWindow!, "postMessage");
    fireEvent.load(frame);
    act(() => vi.advanceTimersByTime(10000));
    expect(screen.getByText(/The preview could not load/)).toBeInTheDocument();
    expect(screen.queryByText(/not ready within 5 s/)).toBeNull();
    expect(post).not.toHaveBeenCalled();
  });

  it("ignores a hello from another window", () => {
    render(
      <HtmlPreview html="<p>Hi</p>" layout="modal" dismissible backdrop="dim" />
    );
    const frame = screen.getByTitle("Message preview") as HTMLIFrameElement;
    const post = vi.spyOn(frame.contentWindow!, "postMessage");
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "hello" },
          origin,
          source: window,
        })
      );
    });
    expect(post).not.toHaveBeenCalled();
  });

  it("does not render twice when it mounts", () => {
    vi.useFakeTimers();
    const { post } = open();
    act(() => vi.advanceTimersByTime(1000));
    expect(
      post.mock.calls.filter(([m]) => (m as { type: string }).type === "render")
    ).toHaveLength(1);
  });

  it("answers a push permission request so its promise resolves", () => {
    const { frame, post } = open();
    show(frame);
    fromPreview(frame, { id: "7", type: "requestPushPermission", args: {} });
    expect(post).toHaveBeenLastCalledWith(
      {
        type: "reply",
        seq: 1,
        message: { v: 1, id: "7", ok: true, result: "granted" },
      },
      origin
    );
  });

  it("says when a field has no value, as the app would skip it", () => {
    const { frame } = open();
    fromPreview(frame, { id: "1", type: "ready", args: { missing: true } });
    expect(
      screen.getByText(/A field has no value and no default/)
    ).toBeInTheDocument();
  });

  it("closes from the close control the app draws, and shows again", () => {
    const { frame, post } = open();
    fromPreview(frame, { id: "1", type: "ready", args: { missing: false } });
    fromPreview(frame, { id: "2", type: "height", args: { value: 200 } });
    post.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByRole("log")).toHaveTextContent("Closed");
    // Torn down, so its sound and scripts stop.
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({ type: "render", seq: 2, html: "" }),
      origin
    );
    expect(screen.queryByText(/Pick an example or start blank/)).toBeNull();
    post.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Show again" }));
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({ type: "render", seq: 3, html: "<p>Hi</p>" }),
      origin
    );
  });

  it("tears the message down when it opens a link", () => {
    const { frame, post } = open();
    show(frame);
    fromPreview(frame, {
      id: "2",
      type: "open",
      args: { url: "https://shop.example" },
    });
    expect(post).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "render", seq: 2, html: "" }),
      origin
    );
  });

  it("ignores an open without a tap", () => {
    const { frame } = open();
    show(frame);
    fromPreview(frame, {
      id: "1",
      type: "open",
      args: { url: "https://shop.example", active: false },
    });
    expect(showErrorNotification).toHaveBeenCalledWith(
      "Ignored: open without a tap"
    );
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("ignores an open to a fragment, without closing", () => {
    const { frame } = open();
    show(frame);
    fromPreview(frame, { id: "1", type: "open", args: { url: "#terms" } });
    expect(showInfoNotification).not.toHaveBeenCalled();
    expect(showErrorNotification).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("drops calls made before the message shows, as the apps do", () => {
    const { frame, post } = open();
    fromPreview(frame, { id: "1", type: "track", args: { name: "early" } });
    fromPreview(frame, {
      id: "2",
      type: "setAttribute",
      args: { key: "k", value: 1 },
    });
    fromPreview(frame, {
      id: "3",
      type: "open",
      args: { url: "https://shop.example" },
    });
    fromPreview(frame, { id: "4", type: "close", args: {} });
    expect(screen.getByRole("log")).toHaveTextContent("Taps that close");
    expect(showInfoNotification).not.toHaveBeenCalled();
    expect(showErrorNotification).not.toHaveBeenCalled();
    fromPreview(frame, { id: "5", type: "requestPushPermission", args: {} });
    expect(post).toHaveBeenLastCalledWith(
      {
        type: "reply",
        seq: 1,
        message: { v: 1, id: "5", ok: false, error: "not_shown" },
      },
      origin
    );
  });

  it("refuses a track with an invalid name or properties", () => {
    const { frame } = open();
    show(frame);
    fromPreview(frame, {
      id: "1",
      type: "track",
      args: { name: "x".repeat(101) },
    });
    fromPreview(frame, {
      id: "2",
      type: "track",
      args: { name: "", properties: {} },
    });
    fromPreview(frame, {
      id: "3",
      type: "track",
      args: { name: "ok", properties: [1] },
    });
    expect(showErrorNotification).toHaveBeenCalledTimes(3);
    expect(showErrorNotification).toHaveBeenCalledWith(
      "Refused track: invalid name"
    );
    expect(screen.getByRole("log")).not.toHaveTextContent("Tracked");
  });

  it("refuses an attribute with a bad key or value, and logs a good one without a toast", () => {
    const { frame } = open();
    show(frame);
    fromPreview(frame, {
      id: "1",
      type: "setAttribute",
      args: { key: "plan", value: { a: 1 } },
    });
    fromPreview(frame, {
      id: "2",
      type: "setAttribute",
      args: { key: "", value: 1 },
    });
    expect(showErrorNotification).toHaveBeenCalledTimes(2);
    fromPreview(frame, {
      id: "3",
      type: "setAttribute",
      args: { key: "plan", value: "pro" },
    });
    expect(screen.getByRole("log")).toHaveTextContent('Set plan to "pro"');
    expect(showInfoNotification).not.toHaveBeenCalled();
  });

  it("renders again in dark mode", () => {
    const { post } = open();
    post.mockClear();
    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({ type: "render", colorScheme: "dark" }),
      origin
    );
  });

  it("shows a modal once it is ready and has a height", () => {
    vi.useFakeTimers();
    const { frame } = open();
    const box = frame.parentElement!.parentElement!.parentElement!;
    expect(parseFloat(box.style.width)).toBeGreaterThan(0);
    // Waiting, it is laid out at its largest (90% of the 844-point screen), invisible.
    expect(frame.style.height).toBe("759.6px");
    expect(frame.style.width).toBe("358px");
    expect(frame).toHaveClass("opacity-0");
    fromPreview(frame, { id: "1", type: "ready", args: { missing: false } });
    fromPreview(frame, { id: "2", type: "height", args: { value: 483 } });
    expect(frame.style.height).toBe("483px");
    expect(frame).not.toHaveClass("opacity-0");
    act(() => vi.advanceTimersByTime(6000));
    expect(screen.queryByText(/not ready within 5 s/)).toBeNull();
  });

  it("never scales the screen to nothing", () => {
    render(
      <HtmlPreview
        html="<p>Hi</p>"
        layout="modal"
        dismissible
        backdrop="dim"
        maxWidth={0}
        maxHeight={-20}
      />
    );
    const frame = screen.getByTitle("Message preview");
    const box = frame.parentElement!.parentElement!.parentElement!;
    expect(parseFloat(box.style.width)).toBeGreaterThan(100);
  });

  it("places landscape messages as the SDKs do", () => {
    // Safe area: 59 points each side, 21 for the home indicator, so 726 x 369.
    expect(messageBox("full", 0, "landscape")).toEqual({
      left: 0,
      top: 0,
      width: 844,
      height: 390,
    });
    const modal = messageBox("modal", 0, "landscape");
    expect(modal.width).toBe(420);
    expect(modal.height).toBeCloseTo(369 * 0.9);
    expect(modal.left).toBeGreaterThanOrEqual(59 + 16);
    expect(modal.left + modal.width).toBeLessThanOrEqual(844 - 59 - 16);
    expect(modal.top + modal.height).toBeLessThanOrEqual(369 - 16);
    expect(messageBox("banner_top", 0, "landscape")).toEqual({
      left: 0,
      top: 0,
      width: 844,
      height: 369 * 0.45,
    });
    expect(messageBox("banner_bottom", 100, "landscape").top).toBe(290);
    // Portrait keeps 30% and starts below the status bar.
    expect(messageBox("banner_top", 0, "phone")).toEqual({
      left: 0,
      top: 47,
      width: 390,
      height: 844 * 0.3,
    });
  });

  it("switches to a phone on its side", () => {
    open();
    const landscape = screen.getByRole("radio", { name: "Phone landscape" });
    expect(landscape).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByTestId("landscape-island")).toBeNull();
    fireEvent.click(landscape);
    expect(landscape).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("landscape-island")).toBeInTheDocument();
    const frame = screen.getByTitle("Message preview");
    expect(frame.style.width).toBe("420px");
    const box = frame.parentElement!.parentElement!.parentElement!;
    expect(parseFloat(box.style.width)).toBeGreaterThan(
      parseFloat(box.style.height)
    );
  });
});
