import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosHeaders } from "axios";
import type { ReactNode } from "react";
import { POST } from "@/lib/api";
import AddFromVisitorsDialog from "../AddFromVisitorsDialog";
import type { Visitor } from "@/types";

vi.mock("@/lib/api", () => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PATCH: vi.fn(),
  DELETE: vi.fn(),
}));
vi.mock("@/lib/config", () => ({ config: { apiPath: "/api/v1" } }));
vi.mock("@/context/useProjectSelection", () => ({
  useProjectSelection: () => ({
    selectedProject: { id: "p1" },
    selectedInstance: { id: "i1" },
    projectType: "production",
  }),
}));

const ok = (data: unknown) => ({
  data,
  status: 200,
  statusText: "OK",
  headers: {},
  config: { headers: new AxiosHeaders() },
});

const visitor = (over: Partial<Visitor> = {}): Visitor => ({
  id: "1",
  uuid: "uuid-1",
  sdk_identifier: "user_1",
  platform: "ios",
  total_views: 0,
  total_opens: 0,
  total_app_opens: 0,
  total_installs: 0,
  total_reinstalls: 0,
  total_reactivations: 0,
  total_user_referred: 0,
  total_time_spent: 0,
  total_revenue: 0,
  updated_at: "2026-09-20T00:00:00Z",
  ...over,
});

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
});

describe("AddFromVisitorsDialog", () => {
  it("sends the search term to the visitors query", async () => {
    vi.mocked(POST).mockResolvedValue(
      ok({ visitors: [visitor()], meta: { total_pages: 1, total_entries: 1 } })
    );
    const onAdd = vi.fn();
    wrap(
      <AddFromVisitorsDialog
        projectId="p1"
        mode="identifiers"
        open
        onOpenChange={vi.fn()}
        onAdd={onAdd}
      />
    );
    await waitFor(() => expect(screen.getByText("uuid-1")).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText("Search visitors"), "ann");

    await waitFor(() =>
      expect(POST).toHaveBeenLastCalledWith(
        "/api/v1/projects/p1/visitors/search",
        expect.objectContaining({ term: "ann" })
      )
    );
  });

  it("keeps a selection made on one page after moving to the next", async () => {
    vi.mocked(POST).mockImplementation(async (_url, body) => {
      const page = (body as { page: number }).page;
      return ok(
        page === 1
          ? {
              visitors: [
                visitor({ id: "1", uuid: "uuid-1", sdk_identifier: "user_1" }),
              ],
              meta: { total_pages: 2, total_entries: 2 },
            }
          : {
              visitors: [
                visitor({ id: "2", uuid: "uuid-2", sdk_identifier: "user_2" }),
              ],
              meta: { total_pages: 2, total_entries: 2 },
            }
      );
    });
    const onAdd = vi.fn();
    wrap(
      <AddFromVisitorsDialog
        projectId="p1"
        mode="identifiers"
        open
        onOpenChange={vi.fn()}
        onAdd={onAdd}
      />
    );
    await waitFor(() => expect(screen.getByText("uuid-1")).toBeInTheDocument());
    await userEvent.click(screen.getByLabelText("Select user_1"));
    expect(screen.getByText("1 selected")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(screen.getByText("uuid-2")).toBeInTheDocument());
    expect(screen.getByText("1 selected")).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Select user_2"));
    expect(screen.getByText("2 selected")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Add 2/ }));
    expect(onAdd).toHaveBeenCalledWith({
      added: ["user_1", "user_2"],
      skipped: 0,
    });
  });

  it("goes back to page 1 when the search changes", async () => {
    vi.mocked(POST).mockResolvedValue(
      ok({ visitors: [visitor()], meta: { total_pages: 3, total_entries: 3 } })
    );
    wrap(
      <AddFromVisitorsDialog
        projectId="p1"
        mode="identifiers"
        open
        onOpenChange={vi.fn()}
        onAdd={vi.fn()}
      />
    );
    await waitFor(() => expect(screen.getByText("uuid-1")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() =>
      expect(screen.getByText("Page 2 of 3")).toBeInTheDocument()
    );

    await userEvent.type(screen.getByLabelText("Search visitors"), "ann");
    await waitFor(() =>
      expect(POST).toHaveBeenLastCalledWith(
        "/api/v1/projects/p1/visitors/search",
        expect.objectContaining({ term: "ann", page: 1 })
      )
    );
    expect(screen.getByText(/^Page 1/)).toBeInTheDocument();
  });

  it("starts clean after it is closed and reopened", async () => {
    vi.mocked(POST).mockResolvedValue(
      ok({ visitors: [visitor()], meta: { total_pages: 1, total_entries: 1 } })
    );
    const dialog = (open: boolean) => (
      <AddFromVisitorsDialog
        projectId="p1"
        mode="identifiers"
        open={open}
        onOpenChange={vi.fn()}
        onAdd={vi.fn()}
      />
    );
    const { rerender } = wrap(dialog(true));
    await waitFor(() => expect(screen.getByText("uuid-1")).toBeInTheDocument());
    await userEvent.type(screen.getByLabelText("Search visitors"), "ann");
    await userEvent.click(screen.getByLabelText("Select user_1"));
    expect(screen.getByText("1 selected")).toBeInTheDocument();

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        {dialog(false)}
      </QueryClientProvider>
    );
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        {dialog(true)}
      </QueryClientProvider>
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Search visitors")).toHaveValue("")
    );
    expect(screen.getByText("0 selected")).toBeInTheDocument();
  });
});
