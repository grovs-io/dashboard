import { format, subDays } from "date-fns";
import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosHeaders, type AxiosResponse } from "axios";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GET, POST, PATCH, DELETE } from "@/lib/api";
import { ApiError } from "@/lib/ApiError";
import { destination } from "./fixtures";
import type { DestinationInput, EventDestination } from "@ee/types/eventStream";
import EventStreamPage from "@ee/app/event_stream/EventStreamPage";

// Browser APIs used by the real Radix controls, absent from jsdom.
beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
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
afterAll(() => vi.unstubAllGlobals());

const auth = vi.hoisted(() => ({ fetchCurrentUser: vi.fn(async () => {}) }));
vi.mock("@/context/useUserContext", () => ({ useUserContext: () => auth }));
const state = vi.hoisted(() => ({
  admin: true,
  enterprise: true,
  edition: true,
  selfHosted: false,
  pending: false,
  subscriptionError: false,
  environment: "Production",
  subscription: null as unknown,
}));
vi.mock("@/lib/api", () => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PATCH: vi.fn(),
  DELETE: vi.fn(),
}));
vi.mock("@/lib/edition", () => ({
  get IS_ENTERPRISE() {
    return state.edition;
  },
  get IS_SELF_HOSTED() {
    return state.selfHosted;
  },
}));
vi.mock("@/lib/config", () => ({
  config: {
    apiUrl: "https://api.example.com",
    apiPath: "/api/v1",
    docsUrl: "https://docs.example.com",
    salesUrl: "https://example.com/sales",
  },
}));
vi.mock("@/components/layout/app-header", () => ({
  default: () => <div data-testid="app-header">Event Stream</div>,
}));
vi.mock("@/hooks/useIsInstanceAdmin", () => ({
  useIsInstanceAdmin: () => state.admin,
}));
vi.mock("@/hooks/queries/usePaymentsQueries", () => ({
  useSubscriptionQuery: () => ({
    data: { isEnterprise: state.enterprise, subscription: state.subscription },
    isPending: state.pending,
    isError: state.subscriptionError,
    refetch: vi.fn(),
  }),
}));
vi.mock("@/context/useProjectSelection", () => ({
  useProjectSelection: () => ({
    projectType: state.environment,
    selectedInstance: {
      id: "i1",
      production: { id: "p1" },
      test: { id: "p2" },
    },
  }),
}));

function response<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: "OK",
    headers: {},
    config: { headers: new AxiosHeaders() },
  };
}
let destinations: EventDestination[];
function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  const ui = () => (
    <QueryClientProvider client={client}>
      <EventStreamPage />
    </QueryClientProvider>
  );
  return {
    ...render(ui()),
    client,
    refresh: (rerender: ReturnType<typeof render>["rerender"]) =>
      rerender(ui()),
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(state, {
    admin: true,
    enterprise: true,
    edition: true,
    selfHosted: false,
    pending: false,
    subscriptionError: false,
    environment: "Production",
    subscription: null,
  });
  destinations = [
    destination(),
    destination({
      id: "d2",
      name: "Archive",
      kind: "s3",
      settings: { bucket: "archive", region: "us-east-1" },
    }),
  ];
  vi.mocked(GET).mockImplementation(async (path) =>
    response(
      path.endsWith("event_stream_tokens")
        ? { event_stream_tokens: [] }
        : { event_destinations: path.includes("/p2/") ? [] : destinations }
    )
  );
  vi.mocked(POST).mockImplementation(async (path, body) => {
    if (path.endsWith("event_destinations")) {
      const input = body as DestinationInput;
      const created = destination({ ...input, id: "d3", name: input.name });
      destinations = [...destinations, created];
      return response({
        event_destination: created,
        signing_secret: input.kind === "webhook" ? "whsec_once" : null,
      });
    }
    if (path.endsWith("event_stream_tokens"))
      return response({ token: "est_once", event_stream_token: { id: "t1" } });
    return response({ message: "Test event delivered" });
  });
  vi.mocked(PATCH).mockResolvedValue(
    response({ event_destination: destination() })
  );
  vi.mocked(DELETE).mockImplementation(async (path) => {
    destinations = destinations.filter((d) => !path.endsWith(`/${d.id}`));
    return response({ message: "Deleted" });
  });
});

describe("event stream management", () => {
  it("blocks duplicate creation if an uncertain response cannot be reconciled, and offers recovery", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(
      await screen.findByRole("button", { name: "Add destination" })
    );
    await user.type(screen.getByLabelText("Name"), "Uncertain connection");
    await user.type(
      screen.getByLabelText("Webhook URL"),
      "https://example.com/uncertain"
    );
    vi.mocked(POST).mockRejectedValue(new ApiError("Connection lost", 0));
    vi.mocked(GET).mockRejectedValue(new ApiError("Connection lost", 0));
    await user.click(screen.getByRole("button", { name: "Create and enable" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Create and enable" })
      ).toBeDisabled()
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen.getByRole("button", { name: "Add destination" })
    ).toBeDisabled();
    vi.mocked(GET).mockImplementation(async (path) =>
      response(
        path.includes("event_stream_tokens")
          ? { event_stream_tokens: [] }
          : { event_destinations: destinations }
      )
    );
    await user.click(screen.getByRole("button", { name: "Refresh lists" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Add destination" })
      ).toBeEnabled()
    );
    expect(POST).toHaveBeenCalledTimes(1);
  });
  it("recovers when project read access is restored", async () => {
    vi.mocked(GET).mockRejectedValue(new ApiError("Forbidden", 403));
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(/no longer have access/);
    vi.mocked(GET).mockImplementation(async (path) =>
      response(
        path.includes("event_stream_tokens")
          ? { event_stream_tokens: [] }
          : { event_destinations: destinations }
      )
    );
    await user.click(screen.getByRole("button", { name: "Retry access" }));
    expect(
      await screen.findByRole("button", { name: "Warehouse" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add destination" })
    ).toBeEnabled();
  });
  it("supports multiple connections and deletes only the selected one after confirmation", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Warehouse" }));
    await user.click(screen.getByRole("button", { name: "Actions" }));
    await user.click(
      screen.getByRole("menuitem", { name: "Delete destination" })
    );
    expect(DELETE).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText(/captured stream data is also purged/)
    ).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole("button", { name: "Delete destination" })
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Warehouse" })
      ).not.toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add destination" })
    ).toBeEnabled();
    expect(DELETE).toHaveBeenCalledWith(
      "/api/v1/projects/p1/event_destinations/d1",
      { maxRetries: 0 }
    );
  });
  it("creates a connection with default event selection and protects its one-time secret", async () => {
    const user = userEvent.setup();
    const view = renderPage();
    await user.click(
      await screen.findByRole("button", { name: "Add destination" })
    );
    await user.type(screen.getByLabelText("Name", { exact: true }), "CRM");
    await user.type(
      screen.getByLabelText("Webhook URL"),
      "https://example.com/crm"
    );
    await user.click(screen.getByLabelText("Event types", { exact: true }));
    expect(
      screen.getByRole("checkbox", { name: /Screen views/ })
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /Time spent/ })
    ).not.toBeChecked();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Create and enable" }));
    expect(await screen.findByDisplayValue("whsec_once")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeEnabled();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(await screen.findByText("Copied to clipboard.")).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe("whsec_once");
    expect(
      JSON.stringify(
        view.client
          .getQueryCache()
          .getAll()
          .map((q) => q.state.data)
      )
    ).not.toContain("whsec_once");
    expect(view.client.getMutationCache().getAll()).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByDisplayValue("whsec_once")).not.toBeInTheDocument();
    expect(
      await screen.findByRole("dialog", { name: "CRM" })
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(
      await screen.findByRole("button", { name: "CRM" })
    ).toBeInTheDocument();
  });
  it("keeps rejected S3 settings in the modal and clears the error when it closes", async () => {
    const message = "Settings endpoint must not resolve to a private address";
    vi.mocked(POST).mockRejectedValueOnce(new ApiError(message, 422));
    const user = userEvent.setup();
    renderPage();
    await user.click(
      await screen.findByRole("button", { name: "Add destination" })
    );
    await user.type(
      screen.getByLabelText("Name", { exact: true }),
      "Test bucket"
    );
    await user.click(screen.getByLabelText("Destination type"));
    await user.click(
      screen.getByRole("option", { name: "S3-compatible bucket" })
    );
    await user.type(screen.getByLabelText("Bucket", { exact: true }), "events");
    await user.type(screen.getByLabelText("Region", { exact: true }), "fsn1");
    await user.type(
      screen.getByLabelText("S3 endpoint URL (optional for AWS)"),
      "https://internal.example.com"
    );
    await user.type(screen.getByLabelText("Access key ID"), "test-key");
    await user.type(screen.getByLabelText("Secret access key"), "test-secret");
    await user.click(screen.getByRole("button", { name: "Create and enable" }));
    const dialog = screen.getByRole("dialog", { name: "Add destination" });
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(message);
    expect(screen.getAllByText(message)).toHaveLength(1);
    expect(screen.getByLabelText("Bucket", { exact: true })).toHaveValue(
      "events"
    );
    expect(
      screen.getByRole("button", { name: "Create and enable" })
    ).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText(message)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add destination" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("shows S3 bucket options without inactive webhook delivery controls", async () => {
    destinations = [
      destination({
        kind: "s3",
        settings: { bucket: "warehouse", region: "eu-north-1" },
      }),
    ];
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Warehouse" }));
    expect(screen.queryByText("Batch size")).not.toBeInTheDocument();
    expect(screen.queryByText("Concurrency")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: /Advanced settings/ }));
    expect(screen.queryByLabelText("Batch size")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Concurrency")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Object prefix (optional)")).toBeVisible();
    await user.type(
      screen.getByLabelText("Object prefix (optional)"),
      "analytics/"
    );
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(PATCH).toHaveBeenCalledWith(
      "/api/v1/projects/p1/event_destinations/d1",
      expect.objectContaining({
        settings: expect.objectContaining({ prefix: "analytics/" }),
      }),
      { maxRetries: 0 }
    );
  });

  it("switching to S3 removes invalid webhook fields from validation", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(
      await screen.findByRole("button", { name: "Add destination" })
    );
    await user.click(screen.getByRole("button", { name: /Advanced settings/ }));
    await user.clear(screen.getByLabelText("Batch size"));
    expect(
      screen.getByRole("button", { name: "Create and enable" })
    ).toBeDisabled();
    await user.click(screen.getByLabelText("Destination type"));
    await user.click(
      screen.getByRole("option", { name: "S3-compatible bucket" })
    );
    expect(screen.queryByLabelText("Batch size")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create and enable" })
    ).toBeEnabled();
    await user.click(screen.getByLabelText("Destination type"));
    await user.click(screen.getByRole("option", { name: "Webhook" }));
    expect(
      screen.getByRole("button", { name: "Create and enable" })
    ).toBeDisabled();
  });

  it("shows delivery limits immediately and blocks saving invalid numbers", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Warehouse" }));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: /Advanced settings/ }));
    const batch = screen.getByLabelText("Batch size");
    const concurrency = screen.getByLabelText("Concurrency");
    const save = screen.getByRole("button", { name: "Save changes" });
    for (const [batchValue, concurrencyValue] of [
      ["1000000000", "400"],
      ["0", "0"],
      ["1.5", "2.5"],
      ["", ""],
    ]) {
      await user.clear(batch);
      if (batchValue) await user.type(batch, batchValue);
      await user.clear(concurrency);
      if (concurrencyValue) await user.type(concurrency, concurrencyValue);
      expect(batch).toHaveAttribute("aria-invalid", "true");
      expect(concurrency).toHaveAttribute("aria-invalid", "true");
      expect(save).toBeDisabled();
    }
    expect(
      screen.getByText("Enter a whole number between 1 and 500.")
    ).toBeVisible();
    expect(
      screen.getByText("Enter a whole number between 1 and 16.")
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: /Advanced settings/ }));
    expect(
      screen.getByText("Correct the delivery settings before saving.")
    ).toBeVisible();
    expect(save).toBeDisabled();
    expect(PATCH).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /Advanced settings/ }));
    await user.type(batch, "500");
    await user.type(concurrency, "16");
    expect(save).toBeEnabled();
    await user.click(save);
    expect(PATCH).toHaveBeenCalledWith(
      "/api/v1/projects/p1/event_destinations/d1",
      expect.objectContaining({ batch_size: 500, concurrency: 16 }),
      { maxRetries: 0 }
    );
  });
  it("keeps existing credentials when editing a destination name", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Warehouse" }));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByLabelText("Name", { exact: true }));
    await user.type(screen.getByLabelText("Name", { exact: true }), "Renamed");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(PATCH).toHaveBeenCalledWith(
      "/api/v1/projects/p1/event_destinations/d1",
      expect.objectContaining({ name: "Renamed" }),
      { maxRetries: 0 }
    );
    expect(vi.mocked(PATCH).mock.calls[0]?.[1]).not.toHaveProperty(
      "credentials"
    );
    expect(vi.mocked(PATCH).mock.calls[0]?.[1]).not.toHaveProperty("kind");
  });
  it("lets members inspect destinations without requesting tokens or offering writes", async () => {
    state.admin = false;
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Warehouse" }));
    expect(
      screen.queryByRole("button", { name: "Add destination" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit" })
    ).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("tab", { name: "Pull feed tokens" }));
    expect(screen.getByText(/Ask an instance admin/)).toBeInTheDocument();
    expect(
      vi
        .mocked(GET)
        .mock.calls.some(([path]) => path.includes("event_stream_tokens"))
    ).toBe(false);
    await user.click(screen.getByRole("tab", { name: "Exports" }));
    expect(
      screen.queryByRole("button", { name: "Start export" })
    ).not.toBeInTheDocument();
  });
  it("uses date presets and omits the destination for email exports", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("tab", { name: "Exports" }));
    await user.click(screen.getByLabelText("Date range"));
    expect(
      screen.queryByRole("dialog", { name: "Start export?" })
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Last 30 days" }));
    await user.keyboard("{Escape}");
    expect(screen.getByText(/30 days selected/)).toBeVisible();
    const start = format(subDays(new Date(), 29), "yyyy-MM-dd");
    const end = format(new Date(), "yyyy-MM-dd");
    await user.click(screen.getByRole("button", { name: "Start export" }));
    expect(POST).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Confirm export" }));
    expect(POST).toHaveBeenCalledWith(
      "/api/v1/projects/p1/event_exports",
      { start_date: start, end_date: end },
      { maxRetries: 0 }
    );
    expect(
      await screen.findByRole("heading", { name: "Export requested" })
    ).toBeVisible();
    expect(screen.getByText("Email download", { exact: true })).toBeVisible();
    expect(screen.queryByLabelText("Date range")).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Create another export" })
    );
    expect(screen.getByLabelText("Date range")).toBeVisible();
    expect(screen.getByText(/7 days selected/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Start export" })).toBeEnabled();
    expect(POST).toHaveBeenCalledTimes(1);
  });
  it("allows an email export when there are no destinations", async () => {
    destinations = [];
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("tab", { name: "Exports" }));
    expect(screen.getByRole("button", { name: "Start export" })).toBeEnabled();
    expect(screen.getByLabelText("Send export to")).toHaveTextContent(
      "Email me a download link"
    );
  });
  it("requires confirmation before exporting to a paused destination without resuming it", async () => {
    destinations = [destination({ status: "paused", paused_reason: "manual" })];
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("tab", { name: "Exports" }));
    await user.click(screen.getByLabelText("Send export to"));
    await user.click(
      screen.getByRole("option", { name: "Warehouse (Webhook, paused)" })
    );
    await user.click(screen.getByRole("button", { name: "Start export" }));
    expect(POST).not.toHaveBeenCalled();
    expect(
      screen.getByText(/sends data despite the pause/)
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm export" }));
    expect(
      await screen.findByRole("heading", { name: "Export requested" })
    ).toBeInTheDocument();
    expect(POST).toHaveBeenCalledTimes(1);
    expect(POST).toHaveBeenCalledWith(
      "/api/v1/projects/p1/event_exports",
      expect.objectContaining({ destination_id: "d1" }),
      { maxRetries: 0 }
    );
  });
  it("confirms replay and leaves a paused destination paused", async () => {
    destinations = [destination({ status: "paused", paused_reason: "manual" })];
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Warehouse" }));
    await user.click(screen.getByRole("button", { name: "Actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Replay events" }));
    expect(
      screen.getByText(/This destination stays paused/)
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Review replay" }));
    expect(POST).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Confirm replay" }));
    expect(POST).toHaveBeenCalledTimes(1);
    expect(POST).toHaveBeenCalledWith(
      "/api/v1/projects/p1/event_destinations/d1/rewind",
      { to: expect.any(String) },
      { maxRetries: 0 }
    );
  });
  it("retains an action error after refreshing removes the selected destination", async () => {
    vi.mocked(POST).mockImplementation(async () => {
      destinations = [];
      throw new ApiError("Destination not found", 404, undefined, {
        error: "Destination not found",
      });
    });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Warehouse" }));
    await user.click(screen.getByRole("button", { name: "Send test event" }));
    const unavailable = await screen.findByRole("dialog", {
      name: "Destination unavailable",
    });
    expect(within(unavailable).getByRole("alert")).toHaveTextContent(
      "Destination not found"
    );
    expect(POST).toHaveBeenCalledTimes(1);
    await user.click(
      within(unavailable).getByRole("button", { name: "Back to destinations" })
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("No destinations yet")).toBeInTheDocument();
  });
  it("shows a test refusal without retrying or replacing live delivery health", async () => {
    vi.mocked(POST).mockRejectedValue(
      new ApiError("Test failed", 502, undefined, { error: "HTTP 403" })
    );
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Warehouse" }));
    await user.click(screen.getByRole("button", { name: "Send test event" }));
    expect(
      await within(screen.getByRole("dialog")).findByText("HTTP 403")
    ).toBeInTheDocument();
    expect(POST).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Test event delivered/)).not.toBeInTheDocument();
  });
  it("links to the external feed guide without showing inline documentation", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(
      await screen.findByRole("tab", { name: "Pull feed tokens" })
    );
    const guide = screen.getByRole("link", { name: /How to read the feed/ });
    expect(guide).toHaveAttribute(
      "href",
      "https://docs.example.com/docs/enterprise/event-stream"
    );
    expect(guide).toHaveAttribute("target", "_blank");
    expect(guide).toHaveAttribute("rel", "noopener noreferrer");
    expect(
      screen.queryByRole("button", { name: "How to read the feed" })
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Fetch your first page")).not.toBeInTheDocument();
    expect(POST).not.toHaveBeenCalled();
  });
  it("clears a displayed secret on an environment switch", async () => {
    const user = userEvent.setup();
    const view = renderPage();
    await user.click(
      await screen.findByRole("tab", { name: "Pull feed tokens" })
    );
    await user.click(
      await screen.findByRole("button", { name: "Create feed token" })
    );
    await user.type(screen.getByLabelText("Token name"), "Warehouse job");
    await user.click(screen.getByRole("button", { name: "Create token" }));
    expect(await screen.findByDisplayValue("est_once")).toBeInTheDocument();
    state.environment = "Test";
    view.refresh(view.rerender);
    expect(screen.queryByDisplayValue("est_once")).not.toBeInTheDocument();
    expect(await screen.findByText("No destinations yet")).toBeInTheDocument();
    expect(GET).toHaveBeenCalledWith(
      "/api/v1/projects/p2/event_destinations",
      expect.any(Object)
    );
  });
  it("ignores a late token-creation response after changing projects", async () => {
    let resolve: (value: AxiosResponse<{ token: string }>) => void = () => {};
    vi.mocked(POST).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    const user = userEvent.setup();
    const view = renderPage();
    await user.click(
      await screen.findByRole("tab", { name: "Pull feed tokens" })
    );
    await user.click(
      await screen.findByRole("button", { name: "Create feed token" })
    );
    await user.type(screen.getByLabelText("Token name"), "Late job");
    await user.click(screen.getByRole("button", { name: "Create token" }));
    state.environment = "Test";
    view.refresh(view.rerender);
    await act(async () => {
      resolve(response({ token: "est_late" }));
    });
    expect(screen.queryByDisplayValue("est_late")).not.toBeInTheDocument();
    expect(await screen.findByText("No destinations yet")).toBeInTheDocument();
  });
  it("preserves the last destination list if a refresh fails", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("button", { name: "Warehouse" });
    vi.mocked(GET).mockRejectedValue(new ApiError("Unavailable", 503));
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(
      await screen.findByText(/Delivery health may be stale/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Warehouse" })
    ).toBeInTheDocument();
  });
});
describe("edition and entitlement", () => {
  it("shows upgrade discovery without fetching project destinations", () => {
    state.enterprise = false;
    renderPage();
    expect(screen.queryByTestId("app-header")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Contact sales" })
    ).toBeInTheDocument();
    expect(GET).not.toHaveBeenCalled();
  });
  it("does not misrepresent an entitlement failure as an upgrade requirement", () => {
    state.subscriptionError = true;
    renderPage();
    expect(
      screen.getByText("Could not check enterprise access.")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Contact sales" })
    ).not.toBeInTheDocument();
  });
  it("does not fetch or render management in Community Edition", () => {
    state.edition = false;
    renderPage();
    expect(GET).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("tab", { name: "Destinations" })
    ).not.toBeInTheDocument();
  });
  it("offers an access check instead of sales when the self-hosted backend refuses access", async () => {
    state.selfHosted = true;
    vi.mocked(GET).mockRejectedValue(new ApiError("Enterprise required", 402));
    renderPage();
    expect(
      await screen.findByRole("button", { name: "Check access" })
    ).toBeInTheDocument();
    expect(screen.queryByTestId("app-header")).not.toBeInTheDocument();
    expect(
      screen.getByText(/Ask your administrator to check Enterprise access/)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Contact sales" })
    ).not.toBeInTheDocument();
  });
  it("allows self-hosted enterprise without a Cloud subscription", async () => {
    state.enterprise = false;
    state.selfHosted = true;
    renderPage();
    expect(
      await screen.findByRole("button", { name: "Warehouse" })
    ).toBeInTheDocument();
  });
  it("allows a non-enterprise instance with an active paid Stripe plan", async () => {
    state.enterprise = false;
    state.subscription = {
      type: "stripe",
      details: { active: true, paused: false },
    };
    renderPage();
    expect(
      await screen.findByRole("button", { name: "Warehouse" })
    ).toBeInTheDocument();
  });
  it("blocks access when the active Stripe subscription has a payment issue", () => {
    state.enterprise = false;
    state.subscription = {
      type: "stripe",
      payment_issue: true,
      details: { active: true, paused: false },
    };
    renderPage();
    expect(
      screen.getByRole("link", { name: "Contact sales" })
    ).toBeInTheDocument();
    expect(GET).not.toHaveBeenCalled();
  });
  it("blocks access when the Stripe subscription is not active", () => {
    state.enterprise = false;
    state.subscription = {
      type: "stripe",
      details: { active: false, paused: false },
    };
    renderPage();
    expect(
      screen.getByRole("link", { name: "Contact sales" })
    ).toBeInTheDocument();
    expect(GET).not.toHaveBeenCalled();
  });
});
