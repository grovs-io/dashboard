import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosHeaders } from "axios";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GET, PATCH, POST } from "@/lib/api";
import { ApiError } from "@/lib/ApiError";
import { catalogue } from "@ee/lib/__tests__/fixtures";
import type { Segment } from "@ee/types/segments";
import SegmentDialog from "../SegmentDialog";

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

const ok = (data: unknown) => ({
  data,
  status: 200,
  statusText: "OK",
  headers: {},
  config: { headers: new AxiosHeaders() },
});
const segment: Segment = {
  id: "s1",
  name: "Buyers",
  description: null,
  definition: {
    version: 1,
    operator: "or",
    groups: [
      {
        operator: "and",
        conditions: [{ type: "event", any: true, window: { last_days: 30 } }],
      },
    ],
  },
  definition_hash: "h",
  archived: false,
  has_identifier_list: false,
  identifier_list: null,
  size: null,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};

const renderDialog = (
  over: Partial<Parameters<typeof SegmentDialog>[0]> = {}
) => {
  const onSaved = vi.fn();
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <TooltipProvider>
        <SegmentDialog
          open
          onOpenChange={vi.fn()}
          projectId="p1"
          onSaved={onSaved}
          {...over}
        />
      </TooltipProvider>
    </QueryClientProvider>
  );
  return { onSaved };
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(GET).mockImplementation(async (url: string) =>
    url.endsWith("/segments/fields")
      ? ok(catalogue)
      : ok({ links: [], meta: { total_pages: 0, total_entries: 0 } })
  );
  vi.mocked(POST).mockImplementation(async (url: string) =>
    url.endsWith("/estimate")
      ? ok({ persons: 1, devices: 1, approximate: false, incomplete: false })
      : ok({ segment: { ...segment, id: "s9" } })
  );
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe("SegmentDialog", () => {
  it("creates the segment from the name and built conditions", async () => {
    const user = userEvent.setup();
    const { onSaved } = renderDialog();
    await user.type(await screen.findByLabelText("Name"), "New buyers");
    await user.click(screen.getByRole("button", { name: "Add condition" }));
    await user.click(
      await screen.findByRole("menuitem", { name: /Did an event/ })
    );
    expect(screen.getByLabelText("Event target")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() =>
      expect(onSaved).toHaveBeenCalledWith(
        expect.objectContaining({ id: "s9" })
      )
    );
    expect(POST).toHaveBeenCalledWith(
      "/api/v1/projects/p1/segments",
      {
        name: "New buyers",
        description: null,
        definition: {
          version: 1,
          operator: "or",
          groups: [
            {
              operator: "and",
              conditions: [
                {
                  type: "event",
                  any: true,
                  count: 1,
                  window: { last_days: 30 },
                },
              ],
            },
          ],
        },
      },
      expect.objectContaining({ maxRetries: 0 })
    );
  });

  it("explains what is missing when Create is pressed too early", async () => {
    const user = userEvent.setup();
    renderDialog();
    const create = await screen.findByRole("button", { name: "Create" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(create);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Give the segment a name before creating it."
    );
    expect(screen.getByText("Name is required")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Name"), "x");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Add at least one condition, so the segment knows who to include."
    );
    await user.click(screen.getByRole("button", { name: "Add condition" }));
    await user.click(
      await screen.findByRole("menuitem", { name: /Did an event/ })
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(POST).not.toHaveBeenCalledWith(
      expect.stringMatching(/segments$/),
      expect.anything(),
      expect.anything()
    );
  });

  it("asks before closing with unsaved changes", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderDialog({ onOpenChange });
    await user.type(await screen.findByLabelText("Name"), "draft");
    await user.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(
      await screen.findByText("Discard unsaved changes?")
    ).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Discard" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("lands an API path error on the row", async () => {
    const user = userEvent.setup();
    vi.mocked(POST).mockImplementation(async (url: string) => {
      if (url.endsWith("/estimate"))
        return ok({
          persons: 1,
          devices: 1,
          approximate: false,
          incomplete: false,
        });
      // Shaped like src/lib/api.ts: generic message, backend text on data.
      throw new ApiError(
        "The provided data is invalid.",
        422,
        "invalid_definition",
        {
          error:
            "Invalid segment definition: groups[0].conditions[0].window: window too wide",
          error_code: "invalid_definition",
        }
      );
    });
    const { onSaved } = renderDialog();
    await user.type(await screen.findByLabelText("Name"), "x");
    await user.click(screen.getByRole("button", { name: "Add condition" }));
    await user.click(
      await screen.findByRole("menuitem", { name: /Did an event/ })
    );
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByText("window too wide")).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("opens an existing segment and updates it", async () => {
    const user = userEvent.setup();
    vi.mocked(PATCH).mockResolvedValue(ok({ segment }));
    const { onSaved } = renderDialog({ segment });
    expect(await screen.findByLabelText("Event target")).toBeInTheDocument();
    expect(screen.getByText("1 group · 1 condition")).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Buyers");
    await user.type(screen.getByLabelText("Name"), " v2");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(PATCH).toHaveBeenCalledWith(
      "/api/v1/projects/p1/segments/s1",
      expect.objectContaining({ name: "Buyers v2" }),
      expect.objectContaining({ maxRetries: 0 })
    );
  });

  it("opens with the requested condition already added and estimates against the segment's list", async () => {
    renderDialog({
      segment: { ...segment, has_identifier_list: true },
      addCondition: { type: "identifier", op: "in_list" },
    });
    expect(
      await screen.findByLabelText("Identifier operator")
    ).toBeInTheDocument();
    expect(screen.getByText("1 group · 2 conditions")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    await waitFor(() =>
      expect(POST).toHaveBeenCalledWith(
        "/api/v1/projects/p1/segments/estimate",
        expect.objectContaining({ segment_id: "s1" }),
        expect.objectContaining({ maxRetries: 0 })
      )
    );
  });
});
