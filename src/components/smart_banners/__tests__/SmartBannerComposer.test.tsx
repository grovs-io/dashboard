import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import SmartBannerComposer, { FIELDS, sectionOf } from "../SmartBannerComposer";
import { INCLUDE_REQUIRED, smartBannerSchema } from "@/schemas/smartBanner";
import { makeBanner, stubResizeObserver } from "./fixtures";

beforeAll(stubResizeObserver);

const onClose = vi.fn();
const closeRef: { current: (() => void) | null } = { current: null };
function Composer(
  props: Omit<
    ComponentProps<typeof SmartBannerComposer>,
    "closeRef" | "onClose"
  >
) {
  return (
    <SmartBannerComposer closeRef={closeRef} onClose={onClose} {...props} />
  );
}
vi.mock("@/context/useProjectSelection", () => ({
  useProjectSelection: () => ({ selectedProject: { id: "p1" } }),
}));

const createAsync = vi.fn();
const updateAsync = vi.fn();
vi.mock("@/hooks/mutations/useSmartBannersMutations", () => ({
  useCreateSmartBannerMutation: () => ({
    mutateAsync: createAsync,
    isPending: false,
  }),
  useUpdateSmartBannerMutation: () => ({
    mutateAsync: updateAsync,
    isPending: false,
  }),
}));
vi.mock("@/lib/Notifications", () => ({
  showErrorNotification: vi.fn(),
  showSuccessNotification: vi.fn(),
}));

const nav = () =>
  within(screen.getByRole("navigation", { name: "Banner sections" }));
const go = (section: string) =>
  userEvent.click(nav().getByRole("button", { name: new RegExp(section) }));
// Publish for a new or draft banner, Save for the rest.
const save = () =>
  userEvent.click(
    screen.queryByRole("button", { name: "Publish" }) ??
      screen.getByRole("button", { name: "Save" })
  );

async function fillRequired() {
  await userEvent.type(screen.getByLabelText("Name"), "Products");
  await go("Content");
  await userEvent.type(screen.getByLabelText("Title"), "Get the app");
}

beforeEach(() => vi.clearAllMocks());

describe("SmartBannerComposer", () => {
  it("lays out the same sections as the in-app composer, with the live preview", () => {
    render(<Composer />);
    expect(
      nav()
        .getAllByRole("button")
        .map((b) => b.textContent)
    ).toEqual(["1Details", "2Targeting", "3Content", "4Style", "5Behaviour"]);
    expect(
      screen.getByRole("form", { name: "Create smart banner" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("smart-banner-phone")).toHaveAttribute(
      "data-platform",
      "ios"
    );
  });

  it("marks the sections with problems and jumps to the first on save", async () => {
    render(<Composer />);
    await go("Behaviour");
    await save();
    expect(await screen.findByText("Name is required")).toBeInTheDocument();
    expect(nav().getByRole("button", { name: /Details/ })).toHaveAttribute(
      "data-state",
      "wrong"
    );
    expect(nav().getByRole("button", { name: /Content/ })).toHaveAttribute(
      "data-state",
      "wrong"
    );
    expect(nav().getByRole("button", { name: /Targeting/ })).toHaveAttribute(
      "data-state",
      "done"
    );
    expect(
      screen.getByText("Fix the highlighted fields before saving.")
    ).toBeInTheDocument();
    await go("Content");
    expect(screen.getByText("Title is required")).toBeInTheDocument();
    expect(createAsync).not.toHaveBeenCalled();
  });

  it("rejects a pattern without a leading slash", async () => {
    render(<Composer />);
    await fillRequired();
    await go("Targeting");
    await userEvent.click(
      screen.getByRole("switch", { name: "Show on all pages" })
    );
    await userEvent.type(screen.getByLabelText("Only on pages"), "products/*");
    await save();
    expect(
      await screen.findByText("Each pattern must start with /")
    ).toBeInTheDocument();
    expect(createAsync).not.toHaveBeenCalled();
  });

  it("creates with the built FormData and returns to the list", async () => {
    createAsync.mockResolvedValue({ id: 1 });
    render(<Composer />);
    await fillRequired();
    await go("Targeting");
    await userEvent.click(
      screen.getByRole("switch", { name: "Show on all pages" })
    );
    await userEvent.type(
      screen.getByLabelText("Only on pages"),
      "/products/*\n*"
    );
    await go("Style");
    await userEvent.click(screen.getByRole("radio", { name: /Bottom/ }));
    expect(screen.getByTestId("smart-banner-preview")).toHaveAttribute(
      "data-position",
      "bottom"
    );
    await save();
    await waitFor(() => expect(createAsync).toHaveBeenCalledTimes(1));
    const fd = createAsync.mock.calls[0]?.[0] as FormData;
    expect(fd.get("smart_banner[name]")).toBe("Products");
    expect(fd.get("smart_banner[position]")).toBe("bottom");
    expect(fd.getAll("smart_banner[url_include][]")).toEqual([
      "/products/*",
      "/*",
    ]);
    expect(onClose).toHaveBeenCalled();
  });

  it("toggles platforms as checkbox cards and follows them in the preview", async () => {
    render(<Composer />);
    const group = screen.getByRole("group", { name: "Platforms" });
    await userEvent.click(within(group).getByRole("checkbox", { name: /iOS/ }));
    expect(
      within(group).getByRole("checkbox", { name: /iOS/ })
    ).toHaveAttribute("aria-checked", "false");
    expect(screen.getByTestId("smart-banner-phone")).toHaveAttribute(
      "data-platform",
      "android"
    );
    await userEvent.click(
      within(group).getByRole("checkbox", { name: /Android/ })
    );
    await save();
    expect(
      await screen.findByText("Pick at least one platform")
    ).toBeInTheDocument();
  });

  it("switches the preview between iOS and Android", async () => {
    render(<Composer />);
    await userEvent.click(
      within(screen.getByRole("radiogroup", { name: "Preview on" })).getByRole(
        "radio",
        { name: "Android" }
      )
    );
    expect(screen.getByTestId("smart-banner-phone")).toHaveAttribute(
      "data-platform",
      "android"
    );
  });

  it("picks a colour from the shared colour field", async () => {
    createAsync.mockResolvedValue({ id: 1 });
    render(<Composer />);
    await fillRequired();
    await go("Style");
    await userEvent.click(
      screen.getByRole("button", { name: "Button: #2563EB" })
    );
    await userEvent.click(screen.getByRole("option", { name: "#10B981" }));
    expect(
      screen.getByRole("button", { name: "Button: #10B981" })
    ).toBeInTheDocument();
    await save();
    await waitFor(() => expect(createAsync).toHaveBeenCalled());
    expect(
      (createAsync.mock.calls[0]?.[0] as FormData).get(
        "smart_banner[button_color]"
      )
    ).toBe("#10B981");
  });

  it("updates an existing banner and shows its values in the preview", async () => {
    updateAsync.mockResolvedValue({ id: 5 });
    render(
      <Composer
        banner={makeBanner(5, "Blog", {
          platforms: ["android"],
          position: "bottom",
          title: "Read in the app",
        })}
      />
    );
    expect(
      screen.getByRole("form", { name: "Edit smart banner" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("smart-banner-preview")).toHaveAttribute(
      "data-position",
      "bottom"
    );
    expect(screen.getByTestId("smart-banner-preview")).toHaveTextContent(
      "Read in the app"
    );
    expect(screen.getByTestId("smart-banner-phone")).toHaveAttribute(
      "data-platform",
      "android"
    );
    await userEvent.type(screen.getByLabelText("Name"), "!");
    await save();
    await waitFor(() =>
      expect(updateAsync).toHaveBeenCalledWith({
        id: 5,
        fd: expect.any(FormData),
      })
    );
  });

  it("clears a picked icon file", async () => {
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:x");
    const revokeObjectURL = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    render(<Composer />);
    await go("Content");
    await userEvent.upload(
      screen.getByLabelText("Choose icon"),
      new File(["x"], "a.png", { type: "image/png" })
    );
    expect(screen.getByRole("img", { name: "App icon" })).toHaveAttribute(
      "src",
      "blob:x"
    );
    await userEvent.click(screen.getByRole("button", { name: "Remove icon" }));
    expect(screen.queryByRole("img", { name: "App icon" })).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:x");
    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
  });

  it("removes a saved icon", async () => {
    updateAsync.mockResolvedValue({ id: 5 });
    render(
      <Composer
        banner={makeBanner(5, "Blog", { icon_url: "https://cdn/icon.png" })}
      />
    );
    expect(screen.getByRole("img", { name: "App icon" })).toHaveAttribute(
      "src",
      "https://cdn/icon.png"
    );
    await go("Content");
    await userEvent.click(screen.getByRole("button", { name: "Remove icon" }));
    expect(screen.queryByRole("img", { name: "App icon" })).toBeNull();
    await save();
    await waitFor(() => expect(updateAsync).toHaveBeenCalled());
    expect(
      (updateAsync.mock.calls[0]?.[0].fd as FormData).get(
        "smart_banner[remove_icon]"
      )
    ).toBe("true");
  });

  it("labels the Platforms and Position groups for assistive tech", async () => {
    render(<Composer />);
    expect(
      screen.getByRole("group", { name: "Platforms" })
    ).toBeInTheDocument();
    await go("Style");
    expect(
      screen.getByRole("radiogroup", { name: "Position" })
    ).toBeInTheDocument();
  });

  it("has no Cancel button and only enables Save on an edited banner once it changes", async () => {
    render(<Composer banner={makeBanner(6, "Sale", { status: "paused" })} />);
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    const saveButton = screen.getByRole("button", { name: "Save" });
    expect(saveButton).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Name"), "x");
    expect(saveButton).toBeEnabled();
  });

  it("asks before discarding when the dialog closes with changes", async () => {
    render(<Composer />);
    act(() => closeRef.current!());
    expect(onClose).toHaveBeenCalledTimes(1);
    await userEvent.type(screen.getByLabelText("Name"), "x");
    act(() => closeRef.current!());
    expect(screen.getByText("Close without saving?")).toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("saves a new banner as a draft or publishes it", async () => {
    createAsync.mockResolvedValue({ id: 1 });
    render(<Composer />);
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(screen.queryByRole("switch", { name: "Active" })).toBeNull();
    await fillRequired();
    await userEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(createAsync).toHaveBeenCalledTimes(1));
    expect(
      (createAsync.mock.calls[0]?.[0] as FormData).get("smart_banner[status]")
    ).toBe("draft");
    await userEvent.click(screen.getByRole("button", { name: "Publish" }));
    await waitFor(() => expect(createAsync).toHaveBeenCalledTimes(2));
    expect(
      (createAsync.mock.calls[1]?.[0] as FormData).get("smart_banner[status]")
    ).toBe("live");
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("reports dirty=false on unmount so the dialog header unlocks", async () => {
    const onDirtyChange = vi.fn();
    const { unmount } = render(
      <Composer
        banner={makeBanner(7, "Blog", { status: "archived" })}
        onDirtyChange={onDirtyChange}
      />
    );
    await userEvent.type(screen.getByLabelText("Name"), "!");
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true));
    unmount();
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  it("offers Save draft and Publish for a draft, and only Save once published", async () => {
    updateAsync.mockResolvedValue({ id: 5 });
    const { unmount } = render(
      <Composer banner={makeBanner(5, "Blog", { status: "draft" })} />
    );
    expect(
      screen.getByRole("button", { name: "Save draft" })
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Publish" }));
    await waitFor(() => expect(updateAsync).toHaveBeenCalledTimes(1));
    expect(
      (updateAsync.mock.calls[0]?.[0].fd as FormData).get(
        "smart_banner[status]"
      )
    ).toBe("live");
    unmount();
    render(<Composer banner={makeBanner(6, "Sale", { status: "paused" })} />);
    expect(screen.queryByRole("button", { name: "Publish" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save draft" })).toBeNull();
    await userEvent.type(screen.getByLabelText("Name"), "!");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(updateAsync).toHaveBeenCalledTimes(2));
    expect(
      (updateAsync.mock.calls[1]?.[0].fd as FormData).get(
        "smart_banner[status]"
      )
    ).toBeNull();
  });

  it("shows the backend's 422 message", async () => {
    const { ApiError } = await import("@/lib/ApiError");
    const { showErrorNotification } = await import("@/lib/Notifications");
    createAsync.mockRejectedValue(
      new ApiError("Invalid", 422, undefined, {
        error: "Validation failed: Title is too long",
      })
    );
    render(<Composer />);
    await fillRequired();
    await save();
    await waitFor(() =>
      expect(showErrorNotification).toHaveBeenCalledWith(
        "Validation failed: Title is too long"
      )
    );
    expect(
      screen.getByText("Validation failed: Title is too long")
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("maps every schema field to a section", () => {
    const keys = Object.keys(smartBannerSchema.shape);
    expect(keys.filter((k) => !sectionOf(k))).toEqual([]);
    expect(Object.values(FIELDS).flat().sort()).toEqual([...keys].sort());
  });

  it("saves the default new banner, shown on all pages", async () => {
    createAsync.mockResolvedValue({ id: 1 });
    render(<Composer />);
    await userEvent.type(screen.getByLabelText("Name"), "testtest");
    await go("Content");
    await userEvent.type(screen.getByLabelText("Title"), "test");
    await userEvent.type(screen.getByLabelText("Subtitle"), "donwload the app");
    await go("Targeting");
    expect(
      screen.getByRole("switch", { name: "Show on all pages" })
    ).toBeChecked();
    expect(screen.queryByLabelText("Only on pages")).toBeNull();
    await save();
    await waitFor(() => expect(createAsync).toHaveBeenCalledTimes(1));
    const fd = createAsync.mock.calls[0]?.[0] as FormData;
    expect(fd.getAll("smart_banner[url_include][]")).toEqual([""]);
    expect(fd.get("smart_banner[open_hide_days]")).toBe("30");
    expect(
      screen.queryByText("Fix the highlighted fields before saving.")
    ).toBeNull();
  });

  it("requires a page once Show on all pages is off", async () => {
    render(<Composer />);
    await fillRequired();
    await go("Targeting");
    await userEvent.click(
      screen.getByRole("switch", { name: "Show on all pages" })
    );
    await go("Behaviour");
    await save();
    expect(await screen.findByText(INCLUDE_REQUIRED)).toBeInTheDocument();
    expect(nav().getByRole("button", { name: /Targeting/ })).toHaveAttribute(
      "data-state",
      "wrong"
    );
    expect(screen.getByLabelText("Only on pages")).toHaveFocus();
    expect(createAsync).not.toHaveBeenCalled();
  });

  it("opens an existing banner's patterns with Show on all pages off", async () => {
    render(
      <Composer
        banner={makeBanner(5, "Blog", {
          url_include: ["/blog/*"],
          url_exclude: ["/blog/drafts*"],
        })}
      />
    );
    await go("Targeting");
    expect(
      screen.getByRole("switch", { name: "Show on all pages" })
    ).not.toBeChecked();
    expect(screen.getByLabelText("Only on pages")).toHaveValue("/blog/*");
    expect(screen.getByLabelText("Except on pages")).toHaveValue(
      "/blog/drafts*"
    );
  });

  it("edits both hide periods with presets and a custom value", async () => {
    createAsync.mockResolvedValue({ id: 1 });
    render(<Composer />);
    await fillRequired();
    await go("Behaviour");
    const opened = screen.getByRole("combobox", {
      name: "When a visitor taps Open",
    });
    expect(opened).toHaveTextContent("30 days");
    expect(
      screen.getByRole("combobox", { name: "When a visitor closes it" })
    ).toHaveTextContent("7 days");
    await userEvent.click(opened);
    await userEvent.click(screen.getByRole("option", { name: "Custom…" }));
    const days = screen.getByLabelText("When a visitor taps Open, days");
    await userEvent.clear(days);
    await userEvent.type(days, "400");
    await save();
    expect(await screen.findByText("0 to 365")).toBeInTheDocument();
    await userEvent.click(opened);
    await userEvent.click(
      screen.getByRole("option", { name: "Until the next page" })
    );
    await save();
    await waitFor(() => expect(createAsync).toHaveBeenCalled());
    expect(
      (createAsync.mock.calls[0]?.[0] as FormData).get(
        "smart_banner[open_hide_days]"
      )
    ).toBe("0");
  });

  it("validates a dropped icon inline in the app-icon tile", async () => {
    render(<Composer />);
    await go("Content");
    expect(
      screen.getByText(/Square image, at least 180×180 px/)
    ).toBeInTheDocument();
    const tile = screen.getByTestId("app-icon-tile");
    const big = new File(["x"], "a.gif", { type: "image/gif" });
    fireEvent.drop(tile, { dataTransfer: { files: [big] } });
    expect(
      await screen.findByText("PNG, JPG or WebP only")
    ).toBeInTheDocument();
  });

  it("marks every section of an existing banner by its real state from the start", () => {
    render(<Composer banner={makeBanner(5, "Blog")} />);
    for (const name of [
      "Details",
      "Targeting",
      "Content",
      "Style",
      "Behaviour",
    ])
      expect(
        nav().getByRole("button", { name: new RegExp(name) })
      ).toHaveAttribute("data-state", "done");
  });

  it("flags an existing banner's invalid section without a save attempt", () => {
    render(
      <Composer banner={makeBanner(5, "Blog", { background_color: "blue" })} />
    );
    expect(nav().getByRole("button", { name: /Style/ })).toHaveAttribute(
      "data-state",
      "wrong"
    );
    expect(nav().getByRole("button", { name: /Content/ })).toHaveAttribute(
      "data-state",
      "done"
    );
  });

  it("keeps unvisited sections of a new banner as to-do", () => {
    render(<Composer />);
    expect(nav().getByRole("button", { name: /Behaviour/ })).toHaveAttribute(
      "data-state",
      "todo"
    );
  });

  it("names a failing field that has no inline error", async () => {
    render(
      <Composer banner={makeBanner(5, "Blog", { background_color: "blue" })} />
    );
    await userEvent.type(screen.getByLabelText("Name"), "!");
    await save();
    expect(
      await screen.findByText(/Fix before saving: background color/)
    ).toBeInTheDocument();
    expect(nav().getByRole("button", { name: /Style/ })).toHaveAttribute(
      "data-state",
      "wrong"
    );
  });
});
