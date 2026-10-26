import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GET, PATCH, POST } from "@/lib/api";
import {
  ok,
  polyfillDom,
  wrap,
} from "@ee/components/push/composer/__tests__/helpers";
import {
  cartSteps,
  journey,
  push as pushStep,
} from "@ee/lib/__tests__/journeyFixtures";
import { ApiError } from "@/lib/ApiError";
import { emptyJourney } from "@ee/lib/journeys";
import type { Journey, JourneyStep } from "@ee/types/journey";
import JourneyDialog from "../JourneyDialog";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}));
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
const openLinkDialog = vi.fn();
vi.mock("@/context/useLinkDialogContext", () => ({
  useGlobalLinkDialog: () => ({ openLinkDialog }),
}));
vi.mock("@/context/useProjectSelection", () => ({
  useProjectSelection: () => ({ selectedProject: { name: "Acme" } }),
}));
vi.mock("@ee/hooks/queries/useInAppSuggestions", () => ({
  useInAppSuggestions: () => ({
    loading: false,
    userAttributes: [],
    eventProperties: [],
  }),
}));

const blank = (): Journey =>
  journey({
    ...emptyJourney(),
    id: "b1",
    name: "",
    goals: [],
    control_group: null,
  });

let stored: Journey;
const onOpenChange = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  stored = journey();
  polyfillDom();
  sessionStorage.clear();
  vi.mocked(GET).mockImplementation((async (path: string) => {
    if (path.includes("/segments"))
      return ok({
        segments: [{ id: "seg1", name: "Big spenders" }],
        truncated: false,
      });
    if (path.includes("/in_app_settings"))
      return ok({
        in_app_settings: {
          enabled: true,
          session_cap: 1,
          day_cap: 1,
          control_group: 0,
        },
      });
    if (path.includes("/journeys/")) return ok({ journey: stored });
    return ok({ values: [], next_cursor: null, fields: [] });
  }) as never);
  vi.mocked(PATCH).mockImplementation((async (_path: string, body: unknown) =>
    ok({
      journey: { ...journey(), ...(body as object), lock_version: 1 },
    })) as never);
  vi.mocked(POST).mockImplementation((async () =>
    ok({ journey: journey({ status: "live" }) })) as never);
});

// The editor inside its dialog, once the journey has loaded.
const open = async (initial: Journey = journey()) => {
  stored = initial;
  const view = wrap(
    <JourneyDialog
      open
      onOpenChange={onOpenChange}
      projectId="p1"
      journeyId={initial.id}
    />
  );
  await screen.findByRole("button", { name: "Save" });
  return view;
};

const panel = () =>
  screen.getByRole("complementary", {
    name: /Overview|Starts when|Leaves when|Step settings/,
  });

describe("JourneyEditor", () => {
  it("opens on the overview with a checklist that leads to each problem", async () => {
    await open(blank());
    expect(within(panel()).getByText("Before you launch")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", {
        name: "Choose the event that starts the journey.",
      })
    );
    expect(
      screen.getByRole("complementary", { name: "Starts when" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /They do something/ })
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Overview" }));
    expect(
      screen.getByRole("complementary", { name: "Overview" })
    ).toBeInTheDocument();
  });

  it("keeps the overview compact: the split bar only with a control group, dates only on request", async () => {
    await open(blank());
    expect(screen.queryByText(/In the journey 100%/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Start date")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("combobox", { name: "Start" }));
    await userEvent.click(screen.getByRole("option", { name: "On a date" }));
    expect(screen.getByLabelText("Start date")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("combobox", { name: "Control group" })
    );
    await userEvent.click(
      screen.getByRole("option", { name: "10% held back" })
    );
    expect(screen.getByText(/In the journey 90%/)).toBeInTheDocument();
  });

  it("puts Starts when beside Leaves when, each with its own editor", async () => {
    await open();
    const starts = screen.getByRole("button", { name: "Starts when…" });
    expect(starts).toHaveTextContent("When someone does add_to_cart");
    expect(starts).toHaveTextContent("Everyone · once ever");
    const leaves = screen.getByRole("button", { name: "Leaves when…" });
    expect(leaves).toHaveTextContent("checkout_completed");
    await userEvent.click(leaves);
    expect(
      screen.getByRole("complementary", { name: "Leaves when" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add another goal" })
    ).toBeInTheDocument();
  });

  it("adds steps only through the + on the links, with Continue at on path ends", async () => {
    await open(blank());
    expect(screen.queryByLabelText("Add a step")).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Add a step at the start" })
    );
    const menu = await screen.findByRole("menu");
    expect(within(menu).getAllByRole("menuitem")).toHaveLength(5);
    await userEvent.click(
      within(menu).getByRole("menuitem", { name: /^Wait/ })
    );
    expect(screen.getByRole("button", { name: "1. Wait" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(within(panel()).getByText("Wait for")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Add a step after 1. Wait" })
    );
    expect(
      await screen.findByRole("menuitem", { name: /Continue at/ })
    ).toBeInTheDocument();
  });

  it("renames in place and saves with the button or Cmd+S", async () => {
    await open();
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();
    expect(screen.getByText("All changes saved")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Rename Cart recovery" })
    );
    const name = screen.getByLabelText("Journey name");
    await userEvent.clear(name);
    await userEvent.type(name, "Cart rescue{Enter}");
    expect(
      screen.getByRole("button", { name: "Rename Cart rescue" })
    ).toBeInTheDocument();
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    await userEvent.keyboard("{Meta>}s{/Meta}");
    await waitFor(() => expect(PATCH).toHaveBeenCalled());
    expect(vi.mocked(PATCH).mock.calls[0]![1]).toMatchObject({
      name: "Cart rescue",
      lock_version: 0,
    });
  });

  it("confirms launch in one short paragraph; Launch stays off while anything is missing", async () => {
    const { unmount } = await open(blank());
    expect(screen.getByRole("button", { name: "Launch" })).toBeDisabled();
    expect(within(panel()).getByText("Before you launch")).toBeInTheDocument();
    unmount();
    await open();
    expect(screen.queryByText("Before you launch")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Launch" }));
    const review = await screen.findByRole("dialog", {
      name: "Launch “Cart recovery”?",
    });
    expect(review).toHaveTextContent(
      "People enter when they do add_to_cart — everyone, once. They go through 5 steps and leave when they do checkout_completed. 10% are held back as a control group. It starts now and runs until you end it."
    );
    expect(review).toHaveTextContent(
      "After launch only messages and timings can change."
    );
    expect(
      within(review).queryByText(/Everything is set|Starts:/)
    ).not.toBeInTheDocument();
    await userEvent.click(
      within(review).getByRole("button", { name: "Launch" })
    );
    await waitFor(() =>
      expect(POST).toHaveBeenCalledWith(
        "/api/v1/projects/p1/journeys/jr1/launch",
        {},
        expect.anything()
      )
    );
    expect(push).toHaveBeenCalledWith("/journeys/jr1");
  });

  it("removes a step with Delete, offers one undo, and Escape deselects", async () => {
    await open();
    await userEvent.click(
      screen.getByRole("button", { name: "5. Set attribute" })
    );
    screen.getByRole("button", { name: "5. Set attribute" }).focus();
    await userEvent.keyboard("{Delete}");
    expect(
      screen.queryByRole("button", { name: "5. Set attribute" })
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(
      screen.getByRole("button", { name: "5. Set attribute" })
    ).toHaveAttribute("aria-pressed", "true");
    await userEvent.keyboard("{Escape}");
    expect(
      screen.getByRole("complementary", { name: "Overview" })
    ).toBeInTheDocument();
  });

  it("ends the undo offer at the next edit, so undo cannot wipe it", async () => {
    await open();
    await userEvent.click(
      screen.getByRole("button", { name: "5. Set attribute" })
    );
    await userEvent.click(screen.getByRole("button", { name: "Delete step" }));
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Rename Cart recovery" })
    );
    await userEvent.type(screen.getByLabelText("Journey name"), "!{Enter}");
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });

  it("offers property filters on a screen event", async () => {
    await open(
      journey({
        entry: {
          type: "event",
          event: { screen: "Home", filters: [] },
          segment_id: null,
          audience_segment_id: null,
        },
      })
    );
    await userEvent.click(screen.getByRole("button", { name: "Starts when…" }));
    expect(
      screen.getByRole("button", { name: /Add a filter/ })
    ).toBeInTheDocument();
  });

  it("keeps edits made elsewhere while an image uploads, and takes its lock_version", async () => {
    let finish: () => void = () => {};
    vi.mocked(POST).mockImplementation((async (path: string) =>
      path.endsWith("/images")
        ? new Promise(
            (resolve) =>
              (finish = () =>
                resolve(
                  ok({ url: "https://cdn.example/new.png", lock_version: 7 })
                ))
          )
        : ok({})) as never);
    await open();
    await userEvent.click(screen.getByRole("button", { name: "2. Send push" }));
    await userEvent.upload(
      document.querySelector<HTMLInputElement>('aside input[type="file"]')!,
      new File(["x"], "promo.png", { type: "image/png" })
    );
    await userEvent.click(
      screen.getByRole("button", { name: "5. Set attribute" })
    );
    await userEvent.clear(screen.getByLabelText("Value"));
    await userEvent.type(screen.getByLabelText("Value"), "later");
    await userEvent.click(screen.getByRole("button", { name: "2. Send push" }));
    await userEvent.type(screen.getByLabelText(/^Title/), "!");
    finish();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "2. Send push" })
      ).toBeInTheDocument()
    );
    await waitFor(() =>
      expect(
        document.querySelector('img[src="https://cdn.example/new.png"]')
      ).not.toBeNull()
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(PATCH).toHaveBeenCalled());
    const body = vi.mocked(PATCH).mock.calls[0]![1] as {
      lock_version: number;
      steps: Record<string, Record<string, unknown>>;
    };
    expect(body.lock_version).toBe(7);
    expect(body.steps.s5!.value).toBe("later");
    expect(body.steps.s2).toMatchObject({
      title: "Your cart misses you!",
      image_url: "https://cdn.example/new.png",
    });
  });

  it("keeps an in-app image that finished uploading after the panel was left and reopened", async () => {
    let finish: () => void = () => {};
    vi.mocked(POST).mockImplementation((async (path: string) =>
      path.endsWith("/images")
        ? new Promise(
            (resolve) =>
              (finish = () =>
                resolve(ok({ url: "https://cdn.example/late.png" })))
          )
        : ok({})) as never);
    await open();
    await userEvent.click(
      screen.getByRole("button", { name: "4. Show in-app" })
    );
    await userEvent.upload(
      screen.getByLabelText("Choose portrait image"),
      new File(["x"], "banner.png", { type: "image/png" })
    );
    await userEvent.click(
      screen.getByRole("button", { name: "5. Set attribute" })
    );
    await userEvent.click(
      screen.getByRole("button", { name: "4. Show in-app" })
    );
    finish();
    await waitFor(() =>
      expect(
        screen.getByTestId("in-app-preview-card").querySelector("img")
      ).toHaveAttribute("src", "https://cdn.example/late.png")
    );
    await userEvent.type(screen.getByRole("textbox", { name: /^Title/ }), "!");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(PATCH).toHaveBeenCalled());
    const body = vi.mocked(PATCH).mock.calls[0]![1] as {
      steps: Record<string, { content: { title: string; image: unknown } }>;
    };
    expect(body.steps.s4!.content.title).toBe("10% off!");
    expect(body.steps.s4!.content.image).toMatchObject({
      portrait: "https://cdn.example/late.png",
    });
  });

  // Holds image uploads until the test lets them finish.
  const heldUploads = () => {
    const pending: (() => void)[] = [];
    vi.mocked(POST).mockImplementation((async (path: string, body: unknown) => {
      if (!path.endsWith("/images")) return ok({});
      const lock = Number((body as FormData).get("lock_version"));
      return new Promise((resolve) =>
        pending.push(() =>
          resolve(
            ok({ url: "https://cdn.example/held.png", lock_version: lock + 9 })
          )
        )
      );
    }) as never);
    return () => pending.splice(0).forEach((finish) => finish());
  };

  it("waits for a pending upload before saving, launching or closing quietly", async () => {
    const finish = heldUploads();
    await open();
    await userEvent.click(screen.getByRole("button", { name: "2. Send push" }));
    await userEvent.type(screen.getByLabelText(/^Title/), "!");
    await userEvent.upload(
      document.querySelector<HTMLInputElement>('aside input[type="file"]')!,
      new File(["x"], "promo.png", { type: "image/png" })
    );
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();
    expect(save).toHaveAttribute("title", "Waiting for the image to upload");
    expect(screen.getByRole("button", { name: "Launch" })).toBeDisabled();
    expect(vi.mocked(POST).mock.calls[0]![1]).toBeInstanceOf(FormData);
    expect(
      (vi.mocked(POST).mock.calls[0]![1] as FormData).get("lock_version")
    ).toBe("0");
    finish();
    await waitFor(() => expect(save).toBeEnabled());
    await userEvent.click(save);
    await waitFor(() => expect(PATCH).toHaveBeenCalled());
    expect(vi.mocked(PATCH).mock.calls[0]![1]).toMatchObject({
      lock_version: 9,
    });
  });

  it("asks before closing while an image uploads, even with nothing else changed", async () => {
    heldUploads();
    await open();
    await userEvent.click(
      screen.getByRole("button", { name: "4. Show in-app" })
    );
    await userEvent.upload(
      screen.getByLabelText("Choose portrait image"),
      new File(["x"], "banner.png", { type: "image/png" })
    );
    await userEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(
      await screen.findByRole("dialog", { name: "Close without saving?" })
    ).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("keeps the higher lock_version when a save and an upload answer out of order", async () => {
    const finish = heldUploads();
    let saved: () => void = () => {};
    vi.mocked(PATCH).mockImplementationOnce(
      (async (_path: string, body: unknown) =>
        new Promise(
          (resolve) =>
            (saved = () =>
              resolve(
                ok({
                  journey: {
                    ...journey(),
                    ...(body as object),
                    lock_version: 1,
                  },
                })
              ))
        )) as never
    );
    await open();
    await userEvent.click(screen.getByRole("button", { name: "2. Send push" }));
    await userEvent.type(screen.getByLabelText(/^Title/), "!");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await userEvent.upload(
      document.querySelector<HTMLInputElement>('aside input[type="file"]')!,
      new File(["x"], "promo.png", { type: "image/png" })
    );
    finish();
    await waitFor(() =>
      expect(
        document.querySelector('img[src="https://cdn.example/held.png"]')
      ).not.toBeNull()
    );
    saved();
    await userEvent.type(screen.getByLabelText(/^Title/), "?");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled()
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(PATCH).toHaveBeenCalledTimes(2));
    expect(vi.mocked(PATCH).mock.calls[1]![1]).toMatchObject({
      lock_version: 9,
    });
  });

  it("shows an upload refused as stale like a save conflict", async () => {
    vi.mocked(POST).mockImplementation((async (path: string) => {
      if (path.endsWith("/images"))
        throw new ApiError("Conflict", 409, undefined, {
          error: "The journey changed elsewhere. Reload to see it.",
        });
      return ok({});
    }) as never);
    await open();
    await userEvent.click(screen.getByRole("button", { name: "2. Send push" }));
    await userEvent.upload(
      document.querySelector<HTMLInputElement>('aside input[type="file"]')!,
      new File(["x"], "promo.png", { type: "image/png" })
    );
    expect(
      (
        await screen.findAllByText(
          "The journey changed elsewhere. Reload to see it."
        )
      ).length
    ).toBeGreaterThan(0);
  });

  it("does not let a late upload for a removed step touch a new one", async () => {
    const finish = heldUploads();
    await open(journey({ first_step: "s1", steps: { s1: pushStep("s1") } }));
    await userEvent.click(screen.getByRole("button", { name: "1. Send push" }));
    await userEvent.upload(
      document.querySelector<HTMLInputElement>('aside input[type="file"]')!,
      new File(["x"], "promo.png", { type: "image/png" })
    );
    await userEvent.click(screen.getByRole("button", { name: "Delete step" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Add a step at the start" })
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /^Send push/ })
    );
    finish();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled()
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(PATCH).toHaveBeenCalled());
    const steps = (
      vi.mocked(PATCH).mock.calls[0]![1] as {
        steps: Record<string, { image_url: string | null }>;
      }
    ).steps;
    expect(Object.keys(steps)).toEqual(["s2"]);
    expect(steps.s2!.image_url).toBeNull();
  });

  it("takes whole numbers only in number fields", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: "1. Wait" }));
    const wait = screen.getByLabelText("Wait for");
    await userEvent.clear(wait);
    await userEvent.type(wait, "-1.5");
    expect(wait).toHaveValue(15);
  });

  it("asks before a wait drops its Time ran out path", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: "3. Wait" }));
    await userEvent.click(screen.getByRole("combobox", { name: "Until" }));
    await userEvent.click(screen.getByRole("option", { name: "Nothing" }));
    const confirm = await screen.findByRole("dialog", {
      name: "Remove the Time ran out path?",
    });
    expect(confirm).toHaveTextContent(
      "This removes the Time ran out path and its 2 steps."
    );
  });

  it("uploads step images, offers Create a link, and starts pushes empty", async () => {
    vi.mocked(POST).mockImplementation((async (path: string) =>
      path.endsWith("/images")
        ? ok({ url: "https://cdn.example/img.png" })
        : ok({ journey: journey({ status: "live" }) })) as never);
    await open();
    await userEvent.click(
      screen.getByRole("button", { name: "Add a step after 2. Send push" })
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /^Send push/ })
    );
    expect(screen.getByLabelText(/^Title/)).toHaveValue("");
    expect(screen.getByLabelText(/^Title/)).toHaveAttribute(
      "placeholder",
      "Write a title"
    );
    expect(screen.getByLabelText(/^Body/)).toHaveAttribute(
      "placeholder",
      "Write a body"
    );
    const input = document.querySelector<HTMLInputElement>(
      'aside input[type="file"]'
    )!;
    await userEvent.upload(
      input,
      new File(["x"], "promo.png", { type: "image/png" })
    );
    expect(await screen.findByText("Uploaded image")).toBeInTheDocument();
    expect(screen.getByLabelText("Or an image URL")).toHaveValue("");
    await waitFor(() =>
      expect(
        document.querySelector('img[src="https://cdn.example/img.png"]')
      ).not.toBeNull()
    );
    const [path, body] = vi.mocked(POST).mock.calls.at(-1)!;
    expect(path).toBe("/api/v1/projects/p1/journeys/jr1/images");
    expect((body as FormData).get("image")).toBeInstanceOf(File);
    await userEvent.click(screen.getByRole("button", { name: "New link" }));
    expect(openLinkDialog).toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole("button", { name: /^\d\. Show in-app$/ })
    );
    const tile = screen.getByLabelText("Choose portrait image");
    await userEvent.upload(
      tile,
      new File(["x"], "banner.png", { type: "image/png" })
    );
    await waitFor(() =>
      expect(
        screen.getByTestId("in-app-preview-card").querySelector("img")
      ).toHaveAttribute("src", "https://cdn.example/img.png")
    );
  });

  it("keeps one panel width and a way back to the overview", async () => {
    await open();
    const aside = screen.getByRole("complementary", { name: "Overview" });
    expect(aside.className).toContain("w-[420px]");
    expect(
      within(aside).queryByRole("button", { name: "Overview" })
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Starts when…" }));
    const entry = screen.getByRole("complementary", { name: "Starts when" });
    expect(entry.className).toContain("w-[420px]");
    expect(
      within(entry).queryByRole("button", { name: "Close panel" })
    ).not.toBeInTheDocument();
    expect(within(entry).getByText("Trigger")).toBeInTheDocument();
    expect(
      within(entry).queryByText("What puts someone in the journey.")
    ).not.toBeInTheDocument();
    await userEvent.click(
      within(entry).getByRole("button", { name: "Overview" })
    );
    expect(
      screen.getByRole("complementary", { name: "Overview" })
    ).toBeInTheDocument();
  });

  it("previews push and in-app steps", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: "2. Send push" }));
    expect(screen.getAllByText("Your cart misses you").length).toBeGreaterThan(
      1
    );
    await userEvent.click(
      screen.getByRole("button", { name: "4. Show in-app" })
    );
    expect(screen.getByTestId("in-app-preview-card")).toHaveTextContent(
      "10% off"
    );
  });

  it("locks the structure of a live journey and saves only what may change", async () => {
    await open(
      journey({
        status: "live",
        launched_at: "2026-09-20T10:00:00Z",
        lock_version: 4,
      })
    );
    expect(
      screen.getByText("Live — only messages and timings can change")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Launch" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Add a step/ })
    ).not.toBeInTheDocument();
    // A single journey has no stats, so the editor shows no counts rather than zeros.
    expect(within(panel()).queryByText(/in the journey now/)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Starts when…" }));
    expect(
      screen.getByRole("radio", { name: /They join a segment/ })
    ).toBeDisabled();
    await userEvent.click(
      screen.getByRole("button", { name: "5. Set attribute" })
    );
    expect(screen.getByLabelText("Key")).toBeDisabled();
    const value = screen.getByLabelText("Value");
    await userEvent.clear(value);
    await userEvent.type(value, "later");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(PATCH).toHaveBeenCalled());
    const body = vi.mocked(PATCH).mock.calls[0]![1] as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["lock_version", "name", "steps"]);
  });

  it("asks before closing with unsaved changes; Escape deselects first", async () => {
    await open();
    expect(
      screen.getByRole("heading", { name: "Edit journey" })
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    onOpenChange.mockClear();
    await userEvent.click(
      screen.getByRole("button", { name: "Rename Cart recovery" })
    );
    await userEvent.type(screen.getByLabelText("Journey name"), "!{Enter}");
    await userEvent.click(screen.getByRole("button", { name: "2. Send push" }));
    await userEvent.keyboard("{Escape}");
    expect(
      screen.getByRole("complementary", { name: "Overview" })
    ).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
    await userEvent.keyboard("{Escape}");
    expect(
      await screen.findByRole("dialog", { name: "Close without saving?" })
    ).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("asks before removing a push a wait waits on, then that wait waits for nothing; undo puts it back", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: "2. Send push" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete step" }));
    const confirm = await screen.findByRole("dialog", {
      name: "Remove this step?",
    });
    expect(confirm).toHaveTextContent(
      "3. Wait waits for it: it will wait for nothing, and its Time ran out path and 2 steps go too."
    );
    await userEvent.click(
      within(confirm).getByRole("button", { name: "Remove" })
    );
    expect(
      screen.queryByRole("button", { name: /Send push|Show in-app/ })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2. Wait" })).toHaveTextContent(
      "1 day"
    );
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(
      screen.getByRole("button", { name: "2. Send push" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3. Wait" })).toHaveTextContent(
      "until they open 2. Send push"
    );
  });

  const split = (paths: [number, string | null][]) =>
    journey({
      first_step: "a",
      steps: {
        a: {
          id: "a",
          type: "split",
          mode: "percent",
          paths: paths.map(([percent, next]) => ({ percent, next })),
        },
        b: pushStep("b"),
        c: pushStep("c"),
      },
    });

  it("asks before a split path or mode change drops steps, and undoes it", async () => {
    await open(
      split([
        [34, "b"],
        [33, null],
        [33, "c"],
      ])
    );
    await userEvent.click(screen.getByRole("button", { name: "1. Split" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Remove path 3" })
    );
    const confirm = await screen.findByRole("dialog", {
      name: "Remove path 3?",
    });
    expect(confirm).toHaveTextContent("This removes 1 step");
    await userEvent.click(
      within(confirm).getByRole("button", { name: "Remove steps" })
    );
    expect(
      screen.queryByRole("button", { name: "3. Send push" })
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(
      screen.getByRole("button", { name: "3. Send push" })
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "1. Split" }));
    await userEvent.click(
      screen.getByRole("radio", { name: /By a condition/ })
    );
    expect(
      await screen.findByRole("dialog", { name: "Split by a condition?" })
    ).toHaveTextContent("This removes 1 step");
  });

  it("adds a third path as an even, valid split", async () => {
    await open(
      split([
        [50, "b"],
        [50, "c"],
      ])
    );
    await userEvent.click(screen.getByRole("button", { name: "1. Split" }));
    await userEvent.click(screen.getByRole("button", { name: "Add a path" }));
    expect(screen.getByLabelText("Path 1 percent")).toHaveValue(34);
    expect(screen.getByLabelText("Path 2 percent")).toHaveValue(33);
    expect(screen.getByLabelText("Path 3 percent")).toHaveValue(33);
    expect(screen.getByText(/Adds up to 100%/)).toBeInTheDocument();
  });

  it("shows an attribute value the API sent as a number", async () => {
    await open(
      journey({
        first_step: "a",
        steps: {
          a: {
            id: "a",
            type: "split",
            mode: "condition",
            condition: { kind: "attribute", key: "age", op: "gt", value: 42 },
            yes_next: null,
            no_next: null,
          },
        },
      })
    );
    expect(screen.getByRole("button", { name: "1. Split" })).toHaveTextContent(
      "age is more than 42?"
    );
    await userEvent.click(screen.getByRole("button", { name: "1. Split" }));
    expect(screen.getByLabelText("Attribute value")).toHaveValue("42");
    expect(
      screen.queryByText("Enter a value to compare with.")
    ).not.toBeInTheDocument();
  });

  it("keeps the undo offer when a media file uploads, since the step does not change", async () => {
    vi.mocked(POST).mockImplementation((async (path: string) =>
      path.endsWith("/images")
        ? ok({ url: "https://cdn.example/clip.png" })
        : ok({})) as never);
    const steps = cartSteps();
    await open(
      journey({
        steps: {
          ...steps,
          s4: {
            ...(steps.s4 as Extract<JourneyStep, { type: "in_app" }>),
            template: "html",
            content: { html: "<p>Hi</p>", layout: "modal" },
          },
        },
      })
    );
    await userEvent.click(
      screen.getByRole("button", { name: "5. Set attribute" })
    );
    await userEvent.click(screen.getByRole("button", { name: "Delete step" }));
    await userEvent.click(
      screen.getByRole("button", { name: "4. Show in-app" })
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Edit design" })
    );
    await userEvent.upload(
      screen.getByLabelText("Upload a file"),
      new File(["x"], "clip.png", { type: "image/png" })
    );
    await screen.findByRole("listitem", { name: "clip.png" });
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
  });

  it("puts an uploaded in-app image on the step as it is when the upload ends", async () => {
    let finish: (url: string) => void = () => {};
    vi.mocked(POST).mockImplementation((async (path: string) =>
      path.endsWith("/images")
        ? new Promise((resolve) => (finish = (url) => resolve(ok({ url }))))
        : ok({})) as never);
    await open();
    await userEvent.click(
      screen.getByRole("button", { name: "4. Show in-app" })
    );
    await userEvent.upload(
      screen.getByLabelText("Choose portrait image"),
      new File(["x"], "banner.png", { type: "image/png" })
    );
    await userEvent.click(
      screen.getByRole("combobox", { name: "Keep it for" })
    );
    await userEvent.click(screen.getByRole("option", { name: "14 days" }));
    finish("https://cdn.example/late.png");
    await waitFor(() =>
      expect(
        screen.getByTestId("in-app-preview-card").querySelector("img")
      ).toHaveAttribute("src", "https://cdn.example/late.png")
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(PATCH).toHaveBeenCalled());
    const body = vi.mocked(PATCH).mock.calls[0]![1] as {
      steps: Record<
        string,
        { valid_days: number; content: { image: unknown } }
      >;
    };
    expect(body.steps.s4!.valid_days).toBe(14);
    expect(body.steps.s4!.content.image).toMatchObject({
      portrait: "https://cdn.example/late.png",
    });
  });

  it("saves a live journey whose end date has passed; only step problems block it", async () => {
    vi.mocked(PATCH).mockImplementation((async (_path: string, body: unknown) =>
      ok({ journey: { ...stored, ...(body as object) } })) as never);
    await open(
      journey({
        status: "live",
        launched_at: "2020-01-01T10:00:00Z",
        end_at: "2020-02-01T10:00:00Z",
      })
    );
    expect(screen.queryByText("To fix before saving")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "2. Send push" }));
    await userEvent.type(screen.getByLabelText(/^Title/), "!");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(PATCH).toHaveBeenCalled());
    await userEvent.clear(screen.getByLabelText(/^Title/));
    vi.mocked(PATCH).mockClear();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText("Fix what is marked first.")
    ).toBeInTheDocument();
    expect(PATCH).not.toHaveBeenCalled();
  });

  it.each([
    [409, "The journey changed elsewhere. Reload to see it."],
    [422, "Steps s2 title can't be blank"],
  ])("shows a %i save error and keeps the changes", async (status, message) => {
    vi.mocked(PATCH).mockRejectedValue(
      new ApiError("Failed", status, undefined, { error: message })
    );
    await open();
    await userEvent.click(
      screen.getByRole("button", { name: "Rename Cart recovery" })
    );
    await userEvent.type(screen.getByLabelText("Journey name"), "!{Enter}");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("shows a launch failure and stays open", async () => {
    vi.mocked(POST).mockRejectedValue(
      new ApiError("Failed", 422, undefined, {
        error: "Choose the segment people enter from.",
      })
    );
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Launch" }));
    const review = await screen.findByRole("dialog", {
      name: "Launch “Cart recovery”?",
    });
    await userEvent.click(
      within(review).getByRole("button", { name: "Launch" })
    );
    expect(
      await screen.findByText("Choose the segment people enter from.")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: "Launch “Cart recovery”?" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Edit journey" })
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
