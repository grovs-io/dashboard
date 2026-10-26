import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosHeaders } from "axios";
import type { ReactNode } from "react";
import { GET, POST } from "@/lib/api";
import AudiencePicker from "../AudiencePicker";
import type { AudienceValue } from "@ee/types/audience";
import type { Segment } from "@ee/types/segments";
import type { Visitor } from "@/types";

vi.mock("@/lib/api", () => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PATCH: vi.fn(),
  DELETE: vi.fn(),
}));
vi.mock("@/lib/config", () => ({ config: { apiPath: "/api/v1" } }));
vi.mock("@/lib/Notifications", () => ({
  showSuccessNotification: vi.fn(),
  showErrorNotification: vi.fn(),
}));
vi.mock("@/context/useProjectSelection", () => ({
  useProjectSelection: () => ({
    selectedProject: { id: "p1" },
    selectedInstance: { id: "i1" },
    projectType: "production",
  }),
}));

const newSegment = vi.hoisted(() => ({
  id: "seg_new",
  name: "Fresh buyers",
  size: null,
}));
vi.mock("@ee/components/segments/SegmentDialog", () => ({
  default: ({
    open,
    onSaved,
  }: {
    open: boolean;
    onSaved: (segment: typeof newSegment) => void;
  }) =>
    open ? (
      <div role="dialog" aria-label="Create Segment">
        <button type="button" onClick={() => onSaved(newSegment)}>
          Save segment
        </button>
      </div>
    ) : null,
}));

const ok = (data: unknown) => ({
  data,
  status: 200,
  statusText: "OK",
  headers: {},
  config: { headers: new AxiosHeaders() },
});

const segment = (over: Partial<Segment> = {}): Segment => ({
  id: "seg_1",
  name: "Active buyers",
  description: null,
  definition: { version: 1, operator: "and", groups: [] },
  definition_hash: "h1",
  archived: false,
  has_identifier_list: false,
  identifier_list: null,
  size: { date: "2026-09-20", persons: 1204, devices: 1500 },
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
  ...over,
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

const emptyValue: AudienceValue = { type: "identifiers", recipients: [] };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(GET).mockResolvedValue(
    ok({ segments: [segment()], truncated: false })
  );
  vi.mocked(POST).mockResolvedValue(
    ok({ visitors: [visitor()], meta: { total_pages: 1, total_entries: 1 } })
  );
  // Radix's Popover/Command need pointer-capture and scrollIntoView, which jsdom lacks.
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
  // cmdk (the segment combobox) needs ResizeObserver, which jsdom lacks.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
    }
  );
});

describe("AudiencePicker", () => {
  it("does not call onChange on mount", () => {
    const onChange = vi.fn();
    wrap(
      <AudiencePicker projectId="p1" value={emptyValue} onChange={onChange} />
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it("emits exactly once for a type-then-switch sequence, even with a late debounce flush", async () => {
    const onChange = vi.fn();
    wrap(
      <AudiencePicker projectId="p1" value={emptyValue} onChange={onChange} />
    );

    const textarea = screen.getByLabelText(
      "User ids, one per line or comma-separated"
    );
    await userEvent.type(textarea, "a");
    await userEvent.click(screen.getByRole("tab", { name: "Segment" }));

    // Let the 300ms parse debounce's flush-driven re-render settle; it must not add a call.
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith({
      type: "segment",
      segmentId: undefined,
      recipients: [],
    });
  });

  it("emits only the active tab's type when switching tabs", async () => {
    const onChange = vi.fn();
    wrap(
      <AudiencePicker projectId="p1" value={emptyValue} onChange={onChange} />
    );

    await userEvent.click(screen.getByRole("tab", { name: "Segment" }));
    expect(onChange).toHaveBeenLastCalledWith({
      type: "segment",
      segmentId: undefined,
      recipients: [],
    });

    await userEvent.click(screen.getByRole("tab", { name: "Devices" }));
    expect(onChange).toHaveBeenLastCalledWith({
      type: "visitors",
      recipients: [],
    });

    await userEvent.click(screen.getByRole("tab", { name: "My user ids" }));
    expect(onChange).toHaveBeenLastCalledWith({
      type: "identifiers",
      recipients: [],
    });
  });

  it("keeps a just-typed edit when the tab switches before the 300ms parse debounce fires", async () => {
    const onChange = vi.fn();
    wrap(
      <AudiencePicker projectId="p1" value={emptyValue} onChange={onChange} />
    );

    const textarea = screen.getByLabelText(
      "User ids, one per line or comma-separated"
    );
    await userEvent.type(textarea, "user_1");
    // Switch away and back immediately — well inside the debounce window, no waitFor here.
    await userEvent.click(screen.getByRole("tab", { name: "Devices" }));
    await userEvent.click(screen.getByRole("tab", { name: "My user ids" }));

    await waitFor(() =>
      expect(
        screen.getByLabelText("User ids, one per line or comma-separated")
      ).toHaveValue("user_1")
    );
    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith({
        type: "identifiers",
        recipients: ["user_1"],
      })
    );
  });

  it("parses and de-duplicates recipients against the shared cap", async () => {
    const onChange = vi.fn();
    wrap(
      <AudiencePicker projectId="p1" value={emptyValue} onChange={onChange} />
    );

    const textarea = screen.getByLabelText(
      "User ids, one per line or comma-separated"
    );
    await userEvent.type(textarea, "a{enter}a{enter}b{enter}c{enter}d");

    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith({
        type: "identifiers",
        recipients: ["a", "b", "c", "d"],
      })
    );
    expect(screen.getByText("4 of 10,000")).toBeInTheDocument();
    expect(screen.getByText(/dropped/)).toBeInTheDocument();
  });

  it("appends identifiers from the visitor dialog and reports skipped rows", async () => {
    vi.mocked(POST).mockResolvedValue(
      ok({
        visitors: [
          visitor({ id: "1", sdk_identifier: "user_1" }),
          visitor({ id: "2", uuid: "uuid-2", sdk_identifier: "" }),
        ],
        meta: { total_pages: 1, total_entries: 2 },
      })
    );
    const onChange = vi.fn();
    wrap(
      <AudiencePicker projectId="p1" value={emptyValue} onChange={onChange} />
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Add from visitors" })
    );
    await waitFor(() => expect(screen.getByText("uuid-1")).toBeInTheDocument());

    await userEvent.click(screen.getByLabelText("Select user_1"));
    await userEvent.click(screen.getByLabelText("Select uuid-2"));
    await userEvent.click(screen.getByRole("button", { name: /Add 2/ }));

    const { showSuccessNotification } = await import("@/lib/Notifications");
    await waitFor(() =>
      expect(showSuccessNotification).toHaveBeenCalledWith(
        "Added 1 identifier, skipped 1 without a user id."
      )
    );

    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith({
        type: "identifiers",
        recipients: ["user_1"],
      })
    );
  });

  it("shows segment sizes and the empty state", async () => {
    const onChange = vi.fn();
    wrap(
      <AudiencePicker
        projectId="p1"
        value={{ type: "segment", recipients: [] }}
        onChange={onChange}
      />
    );

    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: "Select a segment" })
      ).toBeInTheDocument()
    );
    await userEvent.click(
      screen.getByRole("combobox", { name: "Select a segment" })
    );
    expect(await screen.findByText("1,204 people")).toBeInTheDocument();

    vi.mocked(GET).mockResolvedValue(ok({ segments: [], truncated: false }));
    wrap(
      <AudiencePicker
        projectId="p2"
        value={{ type: "segment", recipients: [] }}
        onChange={onChange}
      />
    );
    expect(await screen.findByText(/no segments yet/)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("a member creates a segment in place, selects it and emits once", async () => {
    const onChange = vi.fn();
    wrap(
      <AudiencePicker
        projectId="p1"
        value={{ type: "segment", recipients: [] }}
        onChange={onChange}
      />
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "New segment" })
    );
    await userEvent.click(
      within(screen.getByRole("dialog", { name: "Create Segment" })).getByRole(
        "button",
        {
          name: "Save segment",
        }
      )
    );

    expect(
      screen.queryByRole("dialog", { name: "Create Segment" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Select a segment" })
    ).toHaveTextContent(/^Fresh buyers$/);
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange).toHaveBeenCalledWith({
      type: "segment",
      segmentId: "seg_new",
      recipients: [],
    });
    // The list refresh belongs to the segment mutation hook, not the picker.
    expect(GET).toHaveBeenCalledTimes(1);
  });

  it("offers New segment as the empty-state action", async () => {
    vi.mocked(GET).mockResolvedValue(ok({ segments: [], truncated: false }));
    wrap(
      <AudiencePicker
        projectId="p3"
        value={{ type: "segment", recipients: [] }}
        onChange={vi.fn()}
      />
    );
    expect(
      await screen.findByRole("button", { name: "New segment" })
    ).toBeInTheDocument();
  });

  it("tells same-named segments apart by id", async () => {
    vi.mocked(GET).mockResolvedValue(
      ok({
        segments: [
          segment({
            id: "seg_a",
            name: "test",
            size: { date: "2026-09-20", persons: 10, devices: 12 },
          }),
          segment({
            id: "seg_b",
            name: "test",
            size: { date: "2026-09-20", persons: 20, devices: 24 },
          }),
        ],
        truncated: false,
      })
    );
    const onChange = vi.fn();
    wrap(
      <AudiencePicker
        projectId="p4"
        value={{ type: "segment", recipients: [] }}
        onChange={onChange}
      />
    );
    const combo = await screen.findByRole("combobox", {
      name: "Select a segment",
    });
    await userEvent.click(combo);
    const second = (await screen.findAllByRole("option"))[1]!;
    expect(second).toHaveTextContent("20 people");
    await userEvent.click(second);

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({
        type: "segment",
        segmentId: "seg_b",
        recipients: [],
      })
    );
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(combo).toHaveTextContent(/^test$/);

    await userEvent.click(combo);
    const [first, again] = await screen.findAllByRole("option");
    expect(first!.querySelector("svg")).toHaveClass("opacity-0");
    expect(again!.querySelector("svg")).toHaveClass("opacity-100");
    await userEvent.hover(again!);
    expect(again).toHaveAttribute("aria-selected", "true");
    expect(first).toHaveAttribute("aria-selected", "false");

    await userEvent.type(
      screen.getByPlaceholderText("Search segments…"),
      "seg_"
    );
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });
});
