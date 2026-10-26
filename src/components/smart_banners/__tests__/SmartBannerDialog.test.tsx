import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { ApiError } from "@/lib/ApiError";
import SmartBannerDialog, { DIRTY_STATUS_HINT } from "../SmartBannerDialog";
import { makeBanner, stubResizeObserver } from "./fixtures";

beforeAll(stubResizeObserver);

vi.mock("@/context/useProjectSelection", () => ({
  useProjectSelection: () => ({ selectedProject: { id: "p1" } }),
}));
vi.mock("@/lib/Notifications", () => ({
  showErrorNotification: vi.fn(),
  showSuccessNotification: vi.fn(),
}));
vi.mock("@/api/smartBanners/smartBannersService", () => ({
  getSmartBannerAPICall: vi.fn(),
  updateSmartBannerAPICall: vi.fn(),
  createSmartBannerAPICall: vi.fn(),
}));

import {
  getSmartBannerAPICall,
  updateSmartBannerAPICall,
} from "@/api/smartBanners/smartBannersService";

const banner = (status: "live" | "paused" | "archived") =>
  makeBanner(5, "Blog", { status, title: "Read in the app" });

let client: QueryClient;
const onOpenChange = vi.fn();
const onAction = vi.fn();
const renderDialog = (bannerId: number | null) =>
  render(
    <QueryClientProvider client={client}>
      <SmartBannerDialog
        open
        onOpenChange={onOpenChange}
        projectId="p1"
        bannerId={bannerId}
        domain="shop.com"
        actions={{ onOpen: vi.fn(), onAction }}
      />
    </QueryClientProvider>
  );

beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

describe("SmartBannerDialog", () => {
  it("opens the composer for a new banner", () => {
    renderDialog(null);
    expect(
      screen.getByRole("dialog", { name: "Create smart banner" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
    expect(getSmartBannerAPICall).not.toHaveBeenCalled();
  });

  it("offers the banner's status actions in the edit header, closing on archive", async () => {
    vi.mocked(getSmartBannerAPICall).mockResolvedValue({
      data: { smart_banner: banner("live") },
    } as never);
    renderDialog(5);
    const status = await screen.findByRole("button", {
      name: "Status of Blog: Live",
    });
    await userEvent.click(status);
    expect(screen.getByRole("menuitem", { name: "Pause" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Edit" })).toBeNull();
    await userEvent.click(screen.getByRole("menuitem", { name: "Pause" }));
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 5 }),
      "pause"
    );
    expect(onOpenChange).not.toHaveBeenCalled();
    await userEvent.click(status);
    await userEvent.click(screen.getByRole("menuitem", { name: "Archive" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onAction).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 5 }),
      "archive"
    );
  });

  it("locks the header status button while the composer has unsaved changes", async () => {
    vi.mocked(getSmartBannerAPICall).mockResolvedValue({
      data: { smart_banner: banner("live") },
    } as never);
    renderDialog(5);
    const status = await screen.findByRole("button", {
      name: "Status of Blog: Live",
    });
    expect(status).toBeEnabled();

    await userEvent.click(screen.getByLabelText("Name"));
    await userEvent.type(screen.getByLabelText("Name"), "!");

    const disabled = screen.getByTestId("smart-banner-status-disabled");
    expect(
      screen.getByRole("button", { name: "Status of Blog: Live" })
    ).toBeDisabled();
    await userEvent.hover(disabled);
    expect(
      (await screen.findAllByText(DIRTY_STATUS_HINT)).length
    ).toBeGreaterThan(0);
  });

  it("shows no status menu for a new banner", () => {
    renderDialog(null);
    expect(screen.queryByRole("button", { name: /^Status of/ })).toBeNull();
  });

  it("seeds the form from a fresh fetch, not a stale cached copy", async () => {
    client.setQueryData(
      queryKeys.projects.smartBanner("p1", 5),
      makeBanner(5, "Stale", { status: "live" })
    );
    vi.mocked(getSmartBannerAPICall).mockResolvedValue({
      data: { smart_banner: banner("paused") },
    } as never);
    vi.mocked(updateSmartBannerAPICall).mockResolvedValue({
      data: { smart_banner: banner("paused") },
    } as never);
    renderDialog(5);
    expect(
      screen.getByRole("dialog", { name: "Edit smart banner" })
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("smart-banner-editor-skeleton")
    ).toBeInTheDocument();
    expect(await screen.findByLabelText("Name")).toHaveValue("Blog");
    await userEvent.click(screen.getByRole("button", { name: /Content/ }));
    await userEvent.clear(screen.getByLabelText("Title"));
    await userEvent.type(screen.getByLabelText("Title"), "Read more");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(updateSmartBannerAPICall).toHaveBeenCalledTimes(1)
    );
    const fd = vi.mocked(updateSmartBannerAPICall).mock
      .calls[0]?.[2] as FormData;
    expect(fd.get("smart_banner[name]")).toBe("Blog");
    expect(fd.get("smart_banner[title]")).toBe("Read more");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("asks before closing with unsaved changes", async () => {
    renderDialog(null);
    await userEvent.type(screen.getByLabelText("Name"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(screen.getByText("Close without saving?")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: "Discard changes" })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes straight away when nothing changed", async () => {
    renderDialog(null);
    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText("Close without saving?")).toBeNull();
  });

  it("says an archived banner can't be edited", async () => {
    vi.mocked(getSmartBannerAPICall).mockResolvedValue({
      data: { smart_banner: banner("archived") },
    } as never);
    renderDialog(5);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This banner is archived"
    );
  });

  it("shows 'Banner not found.' on a 404", async () => {
    vi.mocked(getSmartBannerAPICall).mockRejectedValue(
      new ApiError("Not found", 404)
    );
    renderDialog(5);
    expect(await screen.findByText("Banner not found.")).toBeInTheDocument();
  });

  it("stops querying once closed, so a cache removal (e.g. delete) can't 404-refetch", async () => {
    vi.mocked(getSmartBannerAPICall).mockResolvedValue({
      data: { smart_banner: banner("live") },
    } as never);
    const { rerender } = renderDialog(5);
    await screen.findByRole("button", { name: "Status of Blog: Live" });
    expect(getSmartBannerAPICall).toHaveBeenCalledTimes(1);

    rerender(
      <QueryClientProvider client={client}>
        <SmartBannerDialog
          open={false}
          onOpenChange={onOpenChange}
          projectId="p1"
          bannerId={5}
          domain="shop.com"
          actions={{ onOpen: vi.fn(), onAction }}
        />
      </QueryClientProvider>
    );
    // Simulates the delete mutation's cache removal for the now-gone banner.
    client.removeQueries({ queryKey: queryKeys.projects.smartBanner("p1", 5) });
    await new Promise((r) => setTimeout(r, 0));
    expect(getSmartBannerAPICall).toHaveBeenCalledTimes(1);
  });

  it("shows the API error message for a non-404 error", async () => {
    vi.mocked(getSmartBannerAPICall).mockRejectedValue(
      new ApiError("Server error", 500)
    );
    renderDialog(5);
    expect(
      await screen.findByText("Something went wrong, please try again")
    ).toBeInTheDocument();
  });
});
