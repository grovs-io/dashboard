import { beforeEach, describe, expect, it, vi } from "vitest";
import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosHeaders } from "axios";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { POST } from "@/lib/api";
import type { AudienceValue } from "@ee/types/audience";
import ReachPanel from "../ReachPanel";

vi.mock("@/lib/api", () => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PATCH: vi.fn(),
  DELETE: vi.fn(),
}));
vi.mock("@/lib/config", () => ({ config: { apiPath: "/api/v1" } }));

const ok = (data: unknown) => ({
  data,
  status: 200,
  statusText: "OK",
  headers: {},
  config: { headers: new AxiosHeaders() },
});

const estimate = (over: Record<string, unknown>) => {
  const reachable = (over.reachable as number) ?? 0;
  return {
    devices: 0,
    no_channel: 0,
    not_found: 0,
    no_app: 0,
    reachable,
    platforms: {
      ios: { devices: reachable, configured: true },
      android: { devices: 0, configured: true },
    },
    ...over,
  };
};

const ids = (...recipients: string[]): AudienceValue => ({
  type: "identifiers",
  recipients,
});
const ESTIMATE_URL = "/api/v1/projects/p1/push_campaigns/estimate";

let client: QueryClient;
const Wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);
const render = (ui: ReactNode) => rtlRender(ui, { wrapper: Wrapper });

beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

describe("ReachPanel", () => {
  it("estimates the current audience and shows the hero devices count", async () => {
    vi.mocked(POST).mockResolvedValue(
      ok(
        estimate({ devices: 420, no_channel: 5, not_found: 2, reachable: 415 })
      )
    );
    render(<ReachPanel projectId="p1" audience={ids("u1")} />);

    await waitFor(() => expect(screen.getByText("415")).toBeInTheDocument());
    expect(screen.getByText("devices will receive it")).toBeInTheDocument();
    expect(POST).toHaveBeenCalledWith(
      ESTIMATE_URL,
      { audience: { type: "identifiers", recipients: ["u1"] } },
      expect.objectContaining({
        maxRetries: 0,
        signal: expect.any(AbortSignal),
      })
    );
    expect(screen.getByText("5 no push token")).toBeInTheDocument();
    expect(screen.getByText("2 not found")).toBeInTheDocument();
    expect(screen.queryByText(/isn't set up/)).not.toBeInTheDocument();
  });

  it("shows persons and the incomplete badge for a segment audience", async () => {
    vi.mocked(POST).mockResolvedValue(
      ok({
        devices: 900,
        no_channel: 0,
        not_found: 0,
        persons: 600,
        incomplete: true,
        no_app: 250,
        reachable: 650,
        platforms: {
          ios: { devices: 650, configured: true },
          android: { devices: 250, configured: false },
        },
      })
    );
    render(
      <ReachPanel
        projectId="p1"
        audience={{ type: "segment", segmentId: "s1", recipients: [] }}
      />
    );
    await waitFor(() => expect(screen.getByText("600")).toBeInTheDocument());
    expect(screen.getByText("incomplete")).toBeInTheDocument();
    expect(screen.getByText("650")).toBeInTheDocument();
    expect(
      screen.getByText(
        "250 Android devices won't receive it — push isn't set up"
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/no push token/)).not.toBeInTheDocument();
    expect(POST).toHaveBeenCalledWith(
      ESTIMATE_URL,
      { audience: { type: "segment", segment_id: "s1" } },
      expect.anything()
    );
  });

  it("excludes devices on unconfigured platforms from the hero, one line per platform", async () => {
    vi.mocked(POST).mockResolvedValue(
      ok({
        devices: 10,
        no_channel: 2,
        not_found: 0,
        no_app: 5,
        reachable: 3,
        platforms: {
          ios: { devices: 1, configured: false },
          android: { devices: 7, configured: true },
        },
      })
    );
    render(<ReachPanel projectId="p1" audience={ids("u1")} />);
    await waitFor(() => expect(screen.getByText("3")).toBeInTheDocument());
    expect(screen.getByText("devices will receive it")).toBeInTheDocument();
    expect(
      screen.getByText("1 iOS device won't receive it — push isn't set up")
    ).toBeInTheDocument();
    expect(screen.getByText("2 no push token")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Reach by platform")
    ).not.toBeInTheDocument();
  });

  it("splits the reach per platform when both platforms reach devices", async () => {
    vi.mocked(POST).mockResolvedValue(
      ok({
        devices: 12,
        no_channel: 0,
        not_found: 0,
        no_app: 0,
        reachable: 12,
        platforms: {
          ios: { devices: 9, configured: true },
          android: { devices: 3, configured: true },
        },
      })
    );
    render(<ReachPanel projectId="p1" audience={ids("u1")} />);
    const split = await screen.findByLabelText("Reach by platform");
    expect(split).toHaveTextContent("iOS975%");
    expect(split).toHaveTextContent("Android325%");
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("shows zero reach, without contradicting the setup notice, when nothing is configured", async () => {
    vi.mocked(POST).mockResolvedValue(
      ok({
        devices: 4,
        no_channel: 0,
        not_found: 0,
        no_app: 4,
        reachable: 0,
        platforms: {
          ios: { devices: 3, configured: false },
          android: { devices: 1, configured: false },
        },
      })
    );
    render(<ReachPanel projectId="p1" audience={ids("u1")} />);
    await waitFor(() => expect(screen.getByText("0")).toBeInTheDocument());
    expect(
      screen.getByText("3 iOS devices won't receive it — push isn't set up")
    ).toBeInTheDocument();
    expect(
      screen.getByText("1 Android device won't receive it — push isn't set up")
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Reach by platform")
    ).not.toBeInTheDocument();
  });

  it("shows the web or desktop remainder for a segment", async () => {
    vi.mocked(POST).mockResolvedValue(
      ok({
        devices: 1000,
        no_channel: 0,
        not_found: 0,
        persons: 800,
        no_app: 100,
        reachable: 700,
        platforms: {
          ios: { devices: 700, configured: true },
          android: { devices: 100, configured: false },
        },
      })
    );
    render(
      <ReachPanel
        projectId="p1"
        audience={{ type: "segment", segmentId: "s1", recipients: [] }}
      />
    );
    expect(
      await screen.findByText("200 on web or desktop — push isn't available")
    ).toBeInTheDocument();
    expect(screen.getByText("700")).toBeInTheDocument();
  });

  it("never shows a web or desktop line for a list audience", async () => {
    vi.mocked(POST).mockResolvedValue(
      ok(estimate({ devices: 10, no_channel: 4, reachable: 3 }))
    );
    render(<ReachPanel projectId="p1" audience={ids("u1")} />);
    await screen.findByText("4 no push token");
    expect(screen.queryByText(/web or desktop/)).not.toBeInTheDocument();
  });

  it("falls back to all devices when a broad segment has no platform split", async () => {
    vi.mocked(POST).mockResolvedValue(
      ok({
        devices: 50000,
        no_channel: 0,
        not_found: 0,
        persons: 42000,
        no_app: null,
        reachable: null,
        platforms: {
          ios: { devices: null, configured: true },
          android: { devices: null, configured: false },
        },
      })
    );
    render(
      <ReachPanel
        projectId="p1"
        audience={{ type: "segment", segmentId: "s1", recipients: [] }}
      />
    );
    expect(await screen.findByText("50,000")).toBeInTheDocument();
    expect(screen.getByText("devices")).toBeInTheDocument();
    expect(screen.queryByText(/will receive it/)).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Couldn't split this audience by platform — some devices may not receive it."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("42,000")).toBeInTheDocument();
    expect(screen.queryByText(/push isn't set up/)).not.toBeInTheDocument();
    expect(screen.queryByText(/web or desktop/)).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Reach by platform")
    ).not.toBeInTheDocument();
  });

  it("shows a coded error with a working Retry", async () => {
    const { ApiError } = await import("@/lib/ApiError");
    let resolve: (value: unknown) => void = () => {};
    vi.mocked(POST)
      .mockRejectedValueOnce(new ApiError("busy", 429, "segment_busy"))
      .mockImplementationOnce(() => new Promise((r) => (resolve = r)) as never);
    render(<ReachPanel projectId="p1" audience={ids("u1")} />);

    expect(
      await screen.findByText("Segments are busy right now. Retry in a moment.")
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(
      await screen.findByRole("status", { name: "Calculating reach" })
    ).toBeInTheDocument();
    resolve(
      ok(estimate({ devices: 10, no_channel: 0, not_found: 0, reachable: 10 }))
    );
    await waitFor(() => expect(screen.getByText("10")).toBeInTheDocument());
  });

  it("shows a dash, not a crash, for a partial estimate", async () => {
    vi.mocked(POST).mockResolvedValue(ok({ no_channel: 1 }));
    render(<ReachPanel projectId="p1" audience={ids("u1")} />);

    expect(await screen.findByText("1 no push token")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("devices")).toBeInTheDocument();
  });

  it("shows all matched devices for an older backend without reach fields", async () => {
    vi.mocked(POST).mockResolvedValue(
      ok({ devices: 7, no_channel: 0, not_found: 0 })
    );
    render(<ReachPanel projectId="p1" audience={ids("u1")} />);

    expect(await screen.findByText("7")).toBeInTheDocument();
    expect(screen.getByText("devices")).toBeInTheDocument();
    expect(screen.queryByText(/will receive it/)).not.toBeInTheDocument();
    expect(screen.queryByText(/split this audience/)).not.toBeInTheDocument();
  });

  it("stays idle, with no request, for an empty audience", async () => {
    render(<ReachPanel projectId="p1" audience={ids()} />);
    expect(
      screen.getByText("Pick a segment or add recipients to estimate reach.")
    ).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 600));
    expect(POST).not.toHaveBeenCalled();
  });

  it("shows a skeleton, not text or numbers, while the estimate is pending", async () => {
    let resolve: (v: unknown) => void = () => {};
    vi.mocked(POST).mockReturnValue(new Promise((r) => (resolve = r)) as never);
    render(<ReachPanel projectId="p1" audience={ids("u1")} />);
    expect(
      screen.getByRole("status", { name: "Calculating reach" })
    ).toBeInTheDocument();
    await waitFor(() => expect(POST).toHaveBeenCalled());
    expect(screen.queryByText(/devices/)).not.toBeInTheDocument();
    resolve(
      ok(estimate({ devices: 7, no_channel: 0, not_found: 0, reachable: 7 }))
    );
    await waitFor(() => expect(screen.getByText("7")).toBeInTheDocument());
  });

  it("re-estimates after an audience change, debounced, and ignores the superseded response", async () => {
    const pending: ((v: unknown) => void)[] = [];
    vi.mocked(POST).mockImplementation(
      () => new Promise((r) => pending.push(r)) as never
    );
    const { rerender } = render(
      <ReachPanel projectId="p1" audience={ids("u1")} />
    );
    await waitFor(() => expect(POST).toHaveBeenCalledTimes(1));

    rerender(<ReachPanel projectId="p1" audience={ids("u1", "u2")} />);
    rerender(<ReachPanel projectId="p1" audience={ids("u1", "u2", "u3")} />);
    await new Promise((r) => setTimeout(r, 200));
    expect(POST).toHaveBeenCalledTimes(1);
    const firstSignal = (
      vi.mocked(POST).mock.calls[0]![2] as { signal: AbortSignal }
    ).signal;
    expect(firstSignal.aborted).toBe(true);

    await waitFor(() => expect(POST).toHaveBeenCalledTimes(2));
    expect(vi.mocked(POST).mock.calls[1]![1]).toEqual({
      audience: { type: "identifiers", recipients: ["u1", "u2", "u3"] },
    });
    pending[0]!(
      ok(
        estimate({ devices: 111, no_channel: 0, not_found: 0, reachable: 111 })
      )
    );
    pending[1]!(
      ok(
        estimate({ devices: 333, no_channel: 0, not_found: 0, reachable: 333 })
      )
    );
    await waitFor(() => expect(screen.getByText("333")).toBeInTheDocument());
    expect(screen.queryByText("111")).not.toBeInTheDocument();
  });
});
