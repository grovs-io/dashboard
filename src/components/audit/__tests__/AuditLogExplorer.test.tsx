import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { AuditEvent } from "@/types";

const mockedEvents = vi.fn();
const mockedHead = vi.fn();

vi.mock("@/hooks/queries/useAuditQueries", () => ({
  useAuditEventsInfiniteQuery: (...args: unknown[]) => mockedEvents(...args),
  useAuditHeadQuery: (...args: unknown[]) => mockedHead(...args),
}));

vi.mock("@/components/audit/AuditExportTokensDialog", () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div>export-tokens-dialog</div> : null,
}));

vi.mock("@tanstack/react-query", async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

import AuditLogExplorer from "../AuditLogExplorer";
import { ApiError } from "@/lib/ApiError";

const event = (over: Partial<AuditEvent> = {}): AuditEvent => ({
  id: 1,
  sequence: 42,
  occurred_at: "2026-08-13T18:20:35.000Z",
  action: "instance.member_added",
  outcome: "success",
  actor: { type: "user", id: 1, email: "alice@example.com", via: null },
  target: { type: "user", id: 7, email: "bob@example.com" },
  changes: {},
  ip: "127.0.0.1",
  user_agent: null,
  request_id: null,
  prev_hash: null,
  hash: "abcdef0123456789",
  ...over,
});

const eventsResult = (over: Record<string, unknown> = {}) => ({
  data: { pages: [{ events: [event()] }], pageParams: [] },
  isLoading: false,
  isFetching: false,
  isFetchingNextPage: false,
  hasNextPage: false,
  fetchNextPage: vi.fn(),
  error: null,
  ...over,
});

describe("AuditLogExplorer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedHead.mockReturnValue({ data: { sequence: 46, hash: "abc" } });
    mockedEvents.mockReturnValue(eventsResult());
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe = vi.fn();
        disconnect = vi.fn();
        unobserve = vi.fn();
      }
    );
    // cmdk scrolls the highlighted item into view; jsdom has no such method.
    Element.prototype.scrollIntoView = vi.fn();
    // jsdom lacks both; cmdk (the action combobox) needs ResizeObserver.
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe = vi.fn();
        disconnect = vi.fn();
        unobserve = vi.fn();
      }
    );
  });

  const renderExplorer = () => render(<AuditLogExplorer instanceId="i1" />);

  it("renders events in a table", () => {
    renderExplorer();
    expect(screen.getByText("instance.member_added")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
  });

  it("shows the total event count from the head query", () => {
    renderExplorer();
    expect(screen.getByText("46 events")).toBeInTheDocument();
  });

  it("filters by actor email after debounce", async () => {
    renderExplorer();
    fireEvent.change(screen.getByLabelText("Filter by actor email"), {
      target: { value: "bob@example.com" },
    });
    await waitFor(
      () => {
        const last = mockedEvents.mock.calls.at(-1);
        expect(last?.[1]).toMatchObject({
          actor_email: "bob@example.com",
        });
      },
      { timeout: 2000 }
    );
  });

  it("filters by action from the combobox", async () => {
    renderExplorer();
    fireEvent.click(screen.getByLabelText("Filter by action"));
    fireEvent.click(await screen.findByText("user.login"));
    await waitFor(() => {
      const last = mockedEvents.mock.calls.at(-1);
      expect(last?.[1]).toMatchObject({ event_action: "user.login" });
    });
  });

  // Export tokens lives in the page header beside the title, not in the toolbar.
  it("does not render the export tokens control in the toolbar", () => {
    renderExplorer();
    expect(screen.queryByText("Export tokens")).not.toBeInTheDocument();
  });

  it("opens the detail sheet when a row is clicked", async () => {
    renderExplorer();
    fireEvent.click(screen.getByText("instance.member_added"));
    await waitFor(() =>
      expect(screen.getByText("Request ID")).toBeInTheDocument()
    );
  });

  it("shows a notice instead of the table on 403", () => {
    mockedEvents.mockReturnValue(
      eventsResult({
        error: new ApiError("forbidden", 403),
        data: undefined,
      })
    );
    renderExplorer();
    expect(
      screen.getByText(/don't have access to the audit log/i)
    ).toBeInTheDocument();
  });

  it("defaults the date filter to All time with no bounds sent", () => {
    renderExplorer();
    expect(
      screen.getByRole("button", { name: "All time" })
    ).toBeInTheDocument();
    expect(mockedEvents.mock.calls.at(-1)?.[1]).toMatchObject({
      from: "",
      to: "",
    });
  });

  it("sends no date bounds when All time is picked", async () => {
    renderExplorer();
    fireEvent.click(screen.getByRole("button", { name: "All time" }));
    fireEvent.click(await screen.findByText("Last 7 days"));
    await waitFor(() => {
      expect(mockedEvents.mock.calls.at(-1)?.[1]).toMatchObject({
        from: expect.stringContaining("T"),
      });
    });

    fireEvent.click(await screen.findByText("All time"));
    await waitFor(() => {
      expect(mockedEvents.mock.calls.at(-1)?.[1]).toMatchObject({
        from: "",
        to: "",
      });
    });
  });

  // Each control clears itself, so there is no separate clear-all button.
  it("clears the actor email from inside the field", async () => {
    renderExplorer();
    const input = screen.getByLabelText("Filter by actor email");
    fireEvent.change(input, { target: { value: "bob@example.com" } });

    fireEvent.click(
      await screen.findByRole("button", { name: "Clear actor email" })
    );
    expect(input).toHaveValue("");
    await waitFor(() => {
      expect(mockedEvents.mock.calls.at(-1)?.[1]).toMatchObject({
        actor_email: "",
      });
    });
  });

  it("clears the action filter via All actions", async () => {
    renderExplorer();
    fireEvent.click(screen.getByLabelText("Filter by action"));
    fireEvent.click(await screen.findByText("user.login"));
    await waitFor(() =>
      expect(mockedEvents.mock.calls.at(-1)?.[1]).toMatchObject({
        event_action: "user.login",
      })
    );

    fireEvent.click(screen.getByLabelText("Filter by action"));
    fireEvent.click(await screen.findByText("All actions"));
    await waitFor(() =>
      expect(mockedEvents.mock.calls.at(-1)?.[1]).toMatchObject({
        event_action: "",
      })
    );
  });
});
