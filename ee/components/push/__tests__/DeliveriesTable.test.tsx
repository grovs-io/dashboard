import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosHeaders } from "axios";
import type { ReactNode } from "react";
import { GET } from "@/lib/api";
import DeliveriesTable from "../DeliveriesTable";

vi.mock("@/lib/api", () => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PATCH: vi.fn(),
  DELETE: vi.fn(),
}));
vi.mock("@/lib/config", () => ({ config: { apiPath: "/api/v1" } }));
vi.mock("@/components/audience/AudienceItemDetailsDialog", () => ({
  default: ({ open }: { open: { id: string } | null }) =>
    open ? <div role="dialog" aria-label={`Visitor ${open.id}`} /> : null,
}));

const ok = (data: unknown) => ({
  data,
  status: 200,
  statusText: "OK",
  headers: {},
  config: { headers: new AxiosHeaders() },
});

let intersectionCallback: IntersectionObserverCallback | null = null;

const wrap = (ui: ReactNode) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      {ui}
    </QueryClientProvider>
  );

beforeEach(() => {
  vi.clearAllMocks();
  intersectionCallback = null;
  // Radix's Select needs pointer-capture APIs jsdom doesn't implement.
  for (const method of [
    "hasPointerCapture",
    "setPointerCapture",
    "releasePointerCapture",
    "scrollIntoView",
  ]) {
    Object.defineProperty(HTMLElement.prototype, method, {
      configurable: true,
      value: vi.fn(() => false),
    });
  }
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: IntersectionObserverCallback) {
        intersectionCallback = cb;
      }
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
      takeRecords = () => [];
      root = null;
      rootMargin = "";
      thresholds: number[] = [];
    } as unknown as typeof IntersectionObserver
  );
});

describe("DeliveriesTable", () => {
  it("loads more when the sentinel intersects and shows the end of results", async () => {
    vi.mocked(GET)
      .mockResolvedValueOnce(
        ok({
          deliveries: [
            {
              id: 1,
              status: "delivered",
              platform: "ios",
              recipient: "tok1",
              error: null,
              opened_at: null,
              visitor: null,
            },
          ],
          next_after: 1,
        })
      )
      .mockResolvedValueOnce(
        ok({
          deliveries: [
            {
              id: 2,
              status: "failed",
              platform: "android",
              recipient: "tok2",
              error: "Unregistered",
              opened_at: null,
              visitor: { id: 1, uuid: "u2", sdk_identifier: "user_2" },
            },
            {
              id: 3,
              status: "waiting",
              platform: "ios",
              recipient: "tok3",
              error: null,
              opened_at: null,
              visitor: null,
            },
          ],
          next_after: null,
        })
      );
    wrap(<DeliveriesTable projectId="p1" campaignId="c1" />);
    await waitFor(() => expect(screen.getByText("tok1")).toBeInTheDocument());

    await act(async () => {
      intersectionCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });

    await waitFor(() => expect(screen.getByText("user_2")).toBeInTheDocument());
    expect(screen.queryByText("tok2")).not.toBeInTheDocument();
    expect(screen.getByText("End of results")).toBeInTheDocument();
    expect(
      screen.getByText("Device uninstalled or token expired")
    ).toBeInTheDocument();
    expect(screen.getByText("user_2")).toBeInTheDocument();
    expect(screen.getByText("Waiting for the winner")).toBeInTheDocument();
  });

  it("re-fetches with the status query param when the filter changes", async () => {
    vi.mocked(GET).mockResolvedValue(ok({ deliveries: [], next_after: null }));
    wrap(<DeliveriesTable projectId="p1" campaignId="c1" />);
    await waitFor(() =>
      expect(GET).toHaveBeenCalledWith(
        "/api/v1/projects/p1/push_campaigns/c1/deliveries?after=0&limit=50",
        expect.objectContaining({ maxRetries: 0 })
      )
    );

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByText("Failed"));

    await waitFor(() =>
      expect(GET).toHaveBeenLastCalledWith(
        "/api/v1/projects/p1/push_campaigns/c1/deliveries?status=failed&after=0&limit=50",
        expect.objectContaining({ maxRetries: 0 })
      )
    );
  });

  it("keeps the rows while a new filter loads, then shows a compact empty state", async () => {
    let resolve: (value: unknown) => void = () => {};
    vi.mocked(GET)
      .mockResolvedValueOnce(
        ok({
          deliveries: [
            {
              id: 1,
              status: "delivered",
              platform: "ios",
              recipient: "tok1",
              error: null,
              opened_at: null,
              visitor: null,
            },
          ],
          next_after: null,
        })
      )
      .mockImplementationOnce(() => new Promise((r) => (resolve = r)) as never);
    wrap(<DeliveriesTable projectId="p1" campaignId="c1" />);
    expect(await screen.findByText("tok1")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByText("Queued"));
    expect(screen.getByText("tok1")).toBeInTheDocument();

    resolve(ok({ deliveries: [], next_after: null }));
    expect(await screen.findByText("No queued deliveries")).toBeInTheDocument();
    expect(screen.queryByText("No results found")).not.toBeInTheDocument();
  });

  it("opens the visitor's details from a delivery row", async () => {
    vi.mocked(GET).mockResolvedValue(
      ok({
        deliveries: [
          {
            id: 7,
            status: "delivered",
            platform: "ios",
            recipient: "tok7",
            error: null,
            opened_at: null,
            visitor: { id: 42, uuid: "v-42", sdk_identifier: "user_42" },
          },
        ],
        next_after: null,
      })
    );
    wrap(<DeliveriesTable projectId="p1" campaignId="c1" />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Open visitor user_42" })
    );
    expect(
      screen.getByRole("dialog", { name: "Visitor 42" })
    ).toBeInTheDocument();
  });

  it("does not make a row without a visitor clickable", async () => {
    vi.mocked(GET).mockResolvedValue(
      ok({
        deliveries: [
          {
            id: 8,
            status: "failed",
            platform: "android",
            recipient: "user_missing",
            error: null,
            opened_at: null,
            visitor: null,
          },
        ],
        next_after: null,
      })
    );
    wrap(<DeliveriesTable projectId="p1" campaignId="c1" />);
    expect(await screen.findByText("user_missing")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Open visitor/ })
    ).not.toBeInTheDocument();
  });
});
