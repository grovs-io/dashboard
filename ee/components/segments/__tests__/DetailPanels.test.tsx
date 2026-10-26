import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosHeaders } from "axios";
import type { ReactNode } from "react";
import { GET, POST } from "@/lib/api";
import { ApiError } from "@/lib/ApiError";
import { showErrorNotification } from "@/lib/Notifications";
import ExportsPanel from "../ExportsPanel";
import IdentifierListPanel from "../IdentifierListPanel";
import ReachMetrics from "../ReachMetrics";
import SegmentMembers from "../SegmentMembers";
import type { Segment } from "@ee/types/segments";

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
vi.mock("@/components/audience/AudienceItemDetailsDialog", () => ({
  default: ({ open }: { open: { id: string } | null }) =>
    open ? <div data-testid="visitor-dialog">{open.id}</div> : null,
}));

const ok = (data: unknown) => ({
  data,
  status: 200,
  statusText: "OK",
  headers: {},
  config: { headers: new AxiosHeaders() },
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
const segment: Segment = {
  id: "s1",
  name: "Buyers",
  description: null,
  definition: { version: 1, operator: "or", groups: [] },
  definition_hash: "h",
  archived: false,
  has_identifier_list: false,
  identifier_list: null,
  size: null,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};

beforeEach(() => {
  vi.resetAllMocks();
  window.open = vi.fn();
  window.IntersectionObserver = class {
    observe() {}
    disconnect() {}
    unobserve() {}
    takeRecords() {
      return [];
    }
    root = null;
    rootMargin = "";
    thresholds = [];
  } as unknown as typeof IntersectionObserver;
});

describe("ReachMetrics", () => {
  it("shows counts and the incomplete badge", () => {
    render(
      <ReachMetrics
        count={{
          persons: 1200,
          devices: 1500,
          incomplete: true,
          result_id: "r",
        }}
        pending={false}
        error={null}
        onRetry={vi.fn()}
      />
    );
    expect(screen.getByText("1,200")).toBeInTheDocument();
    expect(screen.getByText("1,500")).toBeInTheDocument();
    expect(screen.getByText("incomplete")).toBeInTheDocument();
  });
});

describe("ExportsPanel", () => {
  it("lists this segment's exports and mints a download link on click", async () => {
    const user = userEvent.setup();
    vi.mocked(GET).mockImplementation(async (url: string) => {
      if (url.endsWith("/segment_exports"))
        return ok({
          exports: [
            {
              id: "e1",
              segment_id: "s1",
              status: "ready",
              rows: 12,
              error: null,
              definition_hash: "h",
              created_at: "2026-09-23T00:00:00Z",
              updated_at: "2026-09-23T00:00:00Z",
              download_url: null,
            },
            {
              id: "e2",
              segment_id: "other",
              status: "pending",
              rows: null,
              error: null,
              definition_hash: "h",
              created_at: "2026-09-23T00:00:00Z",
              updated_at: "2026-09-23T00:00:00Z",
              download_url: null,
            },
          ],
        });
      return ok({
        export: {
          id: "e1",
          segment_id: "s1",
          status: "ready",
          rows: 12,
          error: null,
          created_at: "",
          download_url: "https://s3/x.csv",
        },
      });
    });
    wrap(<ExportsPanel projectId="p1" segmentId="s1" />);
    expect(await screen.findByText("Ready")).toBeInTheDocument();
    expect(screen.queryByText("Preparing")).not.toBeInTheDocument();
    expect(screen.getByText(/12 rows/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Download" }));
    await waitFor(() =>
      expect(window.open).toHaveBeenCalledWith(
        "https://s3/x.csv",
        "_blank",
        "noopener"
      )
    );
    expect(GET).toHaveBeenCalledWith(
      "/api/v1/projects/p1/segment_exports/e1",
      expect.objectContaining({ maxRetries: 0 })
    );
  });
});

describe("IdentifierListPanel", () => {
  it("sends pasted identifiers as JSON and reports the count", async () => {
    const user = userEvent.setup();
    vi.mocked(POST).mockResolvedValue(ok({ count: 2 }));
    wrap(<IdentifierListPanel projectId="p1" segment={segment} />);
    await user.click(screen.getByRole("button", { name: "Paste instead" }));
    await user.type(
      screen.getByLabelText("Paste identifiers, one per line"),
      "a\n b \n\na"
    );
    await user.click(screen.getByRole("button", { name: "Publish list" }));
    await waitFor(() =>
      expect(POST).toHaveBeenCalledWith(
        "/api/v1/projects/p1/segments/s1/identifier_list",
        { identifiers: ["a", "b", "a"] },
        expect.objectContaining({ maxRetries: 0 })
      )
    );
  });

  it("explains a concurrent upload", async () => {
    const user = userEvent.setup();
    vi.mocked(POST).mockRejectedValue(new ApiError("busy", 409, "conflict"));
    wrap(<IdentifierListPanel projectId="p1" segment={segment} />);
    await user.click(screen.getByRole("button", { name: "Paste instead" }));
    await user.type(
      screen.getByLabelText("Paste identifiers, one per line"),
      "a"
    );
    await user.click(screen.getByRole("button", { name: "Publish list" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Another upload for this segment is still running"
    );
  });

  it("shows the backend's reason for a rejected list", async () => {
    const user = userEvent.setup();
    vi.mocked(POST).mockRejectedValue(
      new ApiError("The provided data is invalid.", 422, undefined, {
        error: "List has more than 1000000 identifiers",
      })
    );
    wrap(<IdentifierListPanel projectId="p1" segment={segment} />);
    await user.click(screen.getByRole("button", { name: "Paste instead" }));
    await user.type(
      screen.getByLabelText("Paste identifiers, one per line"),
      "a"
    );
    await user.click(screen.getByRole("button", { name: "Publish list" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "List has more than 1000000 identifiers"
    );
  });
});

describe("SegmentMembers", () => {
  it("shows members and the end marker", async () => {
    const page = ok({
      users: [
        {
          id: "u1",
          uuid: "dev-1",
          sdk_identifier: "alice",
          sdk_attributes: null,
          inviter_id: null,
          web_visitor: false,
          person_key: "pk",
          created_at: "2026-09-01T00:00:00Z",
          updated_at: "2026-09-01T00:00:00Z",
        },
      ],
      next_cursor: null,
    });
    vi.mocked(GET).mockResolvedValue(page);
    vi.mocked(POST).mockResolvedValue(page);
    wrap(
      <SegmentMembers
        projectId="p1"
        segmentId="s1"
        resultId="r"
        onExpired={vi.fn()}
      />
    );
    expect(await screen.findByText("alice")).toBeInTheDocument();
    expect(screen.getByText("End of results")).toBeInTheDocument();
    expect(POST).toHaveBeenCalledWith(
      "/api/v1/projects/p1/segments/s1/users",
      { result_id: "r", limit: 50 },
      expect.objectContaining({ maxRetries: 0 })
    );
  });

  it("recovers an expired result once by itself, then offers a manual reload", async () => {
    const user = userEvent.setup();
    const onExpired = vi.fn();
    vi.mocked(GET).mockRejectedValue(
      new ApiError("expired", 410, "result_expired")
    );
    vi.mocked(POST).mockRejectedValue(
      new ApiError("expired", 410, "result_expired")
    );
    wrap(
      <SegmentMembers
        projectId="p1"
        segmentId="s1"
        resultId="r"
        onExpired={onExpired}
      />
    );
    await waitFor(() => expect(onExpired).toHaveBeenCalledTimes(1));
    await user.click(await screen.findByRole("button", { name: "Reload" }));
    expect(onExpired).toHaveBeenCalledTimes(2);
    expect(showErrorNotification).not.toHaveBeenCalled();
  });
});
