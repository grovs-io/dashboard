import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
} from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { DELETE, GET, PATCH, POST } from "@/lib/api";
import { ApiError } from "@/lib/ApiError";
import { queryKeys } from "@/lib/queryKeys";
import type { Link } from "@/types";
import type { PushCampaign } from "@ee/types/push";
import PushCampaignDialog from "../PushCampaignDialog";
import {
  draftCampaign,
  ok,
  polyfillDom,
  wrap,
} from "../composer/__tests__/helpers";
import { BOTH_CONFIGURED } from "@ee/lib/__tests__/fixtures";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
const linkDialog = vi.hoisted(() => ({
  openLinkDialog: vi.fn(),
  openEditLinkDialog: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
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
vi.mock("@/context/useLinkDialogContext", () => ({
  useGlobalLinkDialog: () => linkDialog,
}));
vi.mock("@/context/useProjectSelection", () => ({
  useProjectSelection: () => ({
    selectedProject: { id: "p1", name: "Acme Shop", domain: "acme.sqd.link" },
    selectedInstance: { id: "i1", name: "Acme Instance" },
    projectType: "Production",
  }),
}));

const BASE = "/api/v1/projects/p1/push_campaigns";
const estimateOf = (reachable: number, noApp = 0) => ({
  devices: reachable + noApp,
  no_channel: 0,
  not_found: 0,
  no_app: noApp,
  reachable,
  platforms: {
    ios: { devices: reachable, configured: true },
    android: { devices: noApp, configured: noApp === 0 },
  },
});
const NEW_LINK = {
  id: 4821,
  name: "Spring sale",
  path: "spring",
  active: true,
};
let stored: PushCampaign;
let configurations: unknown[] | Error;
const onOpenChange = vi.fn();

afterEach(() => {
  focusManager.setFocused(undefined);
});

beforeEach(() => {
  vi.clearAllMocks();
  polyfillDom();
  stored = draftCampaign();
  configurations = BOTH_CONFIGURED;
  vi.mocked(GET).mockImplementation(async (path: string) => {
    if (path.endsWith("/instances/i1/configurations")) {
      if (configurations instanceof Error) throw configurations;
      return ok({ configurations });
    }
    if (path.includes("/segments"))
      return ok({ segments: [], truncated: false });
    if (path.includes("/links/lookup")) return ok({ links: [] });
    return ok({ push_campaign: stored });
  });
  vi.mocked(POST).mockImplementation(async (path: string) => {
    if (path === BASE) return ok({ push_campaign: stored }, 201);
    if (path.endsWith("/estimate")) return ok(estimateOf(3, 2));
    if (path.endsWith("/send"))
      return ok({ push_campaign: { ...stored, status: "sending" } });
    if (path.endsWith("/links/by_ids")) return ok({ links: [NEW_LINK] });
    return ok({});
  });
  vi.mocked(PATCH).mockImplementation(async () =>
    ok({ push_campaign: stored })
  );
});

const open = (campaignId?: string) =>
  wrap(
    <PushCampaignDialog
      open
      onOpenChange={onOpenChange}
      projectId="p1"
      campaignId={campaignId}
    />
  );

const createCalls = () =>
  vi.mocked(POST).mock.calls.filter(([path]) => path === BASE);
const nav = (name: RegExp) =>
  userEvent.click(
    within(
      screen.getByRole("navigation", { name: "Campaign sections" })
    ).getByRole("button", {
      name,
    })
  );

async function fillMessage() {
  await userEvent.type(screen.getByLabelText("Title"), "Hello");
  await userEvent.type(screen.getByLabelText("Body"), "World");
}

async function addUserId(id: string) {
  await nav(/Audience/);
  await userEvent.click(
    await screen.findByRole("tab", { name: "My user ids" })
  );
  await userEvent.type(
    screen.getByLabelText("User ids, one per line or comma-separated"),
    id
  );
}

describe("PushCampaignDialog", () => {
  it("opens empty for a new campaign on the Message section", async () => {
    open();
    expect(
      screen.getByRole("heading", { name: "Create push campaign" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("");
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Message/ })).toHaveAttribute(
      "aria-current",
      "step"
    );
  });

  it("opens an existing draft seeded with its content", async () => {
    open("k9Qx2");
    expect(await screen.findByLabelText("Title")).toHaveValue("Spring is here");
    expect(
      screen.getByRole("heading", { name: "Edit push campaign" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Body")).toHaveValue("Open the app");
  });

  it("switches the visible section from the side nav", async () => {
    open();
    expect(
      screen.queryByRole("radio", { name: "Send now" })
    ).not.toBeInTheDocument();
    await nav(/Delivery/);
    expect(screen.getByRole("radio", { name: "Send now" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Delivery" })
    ).toBeInTheDocument();
    await nav(/Audience/);
    expect(
      await screen.findByRole("tab", { name: "Segment" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("radio", { name: "Send now" })
    ).not.toBeInTheDocument();
  });

  it("previews with the project's name and switches platform", async () => {
    open();
    const preview = screen.getByTestId("push-preview");
    expect(within(preview).getByText("Acme Shop")).toBeInTheDocument();
    expect(preview).toHaveAttribute("data-platform", "ios");
    await userEvent.click(screen.getByRole("button", { name: "Android" }));
    expect(screen.getByTestId("push-preview")).toHaveAttribute(
      "data-platform",
      "android"
    );
  });

  it("puts the preview above the section list in one left rail", async () => {
    open();
    const nav = screen.getByRole("navigation", { name: "Campaign sections" });
    const rail = nav.closest("aside") as HTMLElement;
    expect(rail).not.toBeNull();
    const preview = within(rail).getByTestId("push-preview");
    expect(
      preview.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    await userEvent.click(
      within(nav).getByRole("button", { name: /Audience/ })
    );
    expect(
      await screen.findByRole("tab", { name: "Segment" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Audience" })
    ).toBeInTheDocument();
  });

  it("sends a custom sound file name, and silent as null", async () => {
    open("k9Qx2");
    await screen.findByLabelText("Title");
    await userEvent.click(screen.getByRole("button", { name: /Advanced/ }));
    await userEvent.click(screen.getByRole("combobox", { name: "Sound" }));
    await userEvent.click(
      await screen.findByRole("option", { name: "Custom…" })
    );
    await userEvent.type(screen.getByLabelText("Sound file"), "chime.caf");
    await nav(/Audience/);
    await waitFor(() =>
      expect(PATCH).toHaveBeenCalledWith(
        `${BASE}/k9Qx2`,
        { sound: "chime.caf" },
        { maxRetries: 0 }
      )
    );

    await nav(/Message/);
    await userEvent.click(screen.getByRole("combobox", { name: "Sound" }));
    await userEvent.click(
      await screen.findByRole("option", { name: "Silent" })
    );
    await nav(/Delivery/);
    await waitFor(() =>
      expect(PATCH).toHaveBeenLastCalledWith(
        `${BASE}/k9Qx2`,
        { sound: null },
        { maxRetries: 0 }
      )
    );
  });

  it("drops the custom sound name error once the mode is back to Default", async () => {
    open("k9Qx2");
    await screen.findByLabelText("Title");
    await userEvent.click(screen.getByRole("button", { name: /Advanced/ }));
    await userEvent.click(screen.getByRole("combobox", { name: "Sound" }));
    await userEvent.click(
      await screen.findByRole("option", { name: "Custom…" })
    );
    await userEvent.click(screen.getByRole("button", { name: "Send now" }));
    expect(
      await screen.findByText("Enter the sound file name, such as chime.caf.")
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("combobox", { name: "Sound" }));
    await userEvent.click(
      await screen.findByRole("option", { name: "Default sound" })
    );
    await waitFor(() =>
      expect(
        screen.queryByText("Enter the sound file name, such as chime.caf.")
      ).not.toBeInTheDocument()
    );
    await userEvent.click(screen.getByRole("button", { name: "Send now" }));
    expect(
      await screen.findByRole("dialog", { name: "Send this campaign now?" })
    ).toBeInTheDocument();
  });

  it("does not re-send a rejected save on a section switch, only on Save draft", async () => {
    vi.mocked(PATCH).mockRejectedValue(new ApiError("Title is too long", 422));
    open("k9Qx2");
    await userEvent.type(await screen.findByLabelText("Title"), "!");
    await nav(/Audience/);
    expect(await screen.findByText("Title is too long")).toBeInTheDocument();
    expect(PATCH).toHaveBeenCalledTimes(1);

    await nav(/Delivery/);
    await nav(/Message/);
    expect(PATCH).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(PATCH).toHaveBeenCalledTimes(2));
  });

  it("asks before closing when only the schedule changed", async () => {
    open("k9Qx2");
    await screen.findByLabelText("Title");
    await nav(/Delivery/);
    await userEvent.click(screen.getByRole("radio", { name: "Schedule" }));
    await userEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(
      await screen.findByText("Discard unsaved changes?")
    ).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("drops a pending autosave when the edits are discarded", async () => {
    open();
    await fillMessage();
    await addUserId("user_1");
    await screen.findByText(/^1 of 10,000/);
    await userEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Discard" })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(createCalls()).toHaveLength(0);
  });

  it("writes the campaign fetched after a 409 into the query cache", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.mocked(PATCH).mockImplementation(async () => {
      stored = draftCampaign({ title: "Changed elsewhere" });
      throw new ApiError("Campaign changed", 409);
    });
    render(
      <QueryClientProvider client={client}>
        <PushCampaignDialog
          open
          onOpenChange={onOpenChange}
          projectId="p1"
          campaignId="k9Qx2"
        />
      </QueryClientProvider>
    );
    await userEvent.type(await screen.findByLabelText("Title"), "!");
    await userEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() =>
      expect(
        client.getQueryData<PushCampaign>(
          queryKeys.projects.pushCampaign("p1", "k9Qx2")
        )?.title
      ).toBe("Changed elsewhere")
    );
  });

  it("names the primary button after the delivery choice", async () => {
    open();
    expect(
      screen.getByRole("button", { name: "Send now" })
    ).toBeInTheDocument();
    await nav(/Delivery/);
    await userEvent.click(screen.getByRole("radio", { name: "Schedule" }));
    expect(
      screen.getByRole("button", { name: "Schedule…" })
    ).toBeInTheDocument();
  });

  it("a member saves a draft and can send or schedule it", async () => {
    open();
    await fillMessage();
    await addUserId("user_1");
    await waitFor(() => expect(createCalls()).toHaveLength(1), {
      timeout: 2000,
    });
    expect(screen.getByRole("button", { name: "Save draft" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Send now" })).toBeEnabled();
    await nav(/Delivery/);
    await userEvent.click(screen.getByRole("radio", { name: "Schedule" }));
    expect(
      screen.getByRole("button", { name: "Schedule…" })
    ).toBeInTheDocument();
  });

  it("creates the draft as JSON once it has an audience, sending the title as the name", async () => {
    open();
    await fillMessage();
    expect(createCalls()).toHaveLength(0);

    await addUserId("user_1");
    await waitFor(() => expect(createCalls()).toHaveLength(1), {
      timeout: 2000,
    });
    expect(createCalls()[0]).toEqual([
      BASE,
      {
        name: "Hello",
        title: "Hello",
        body: "World",
        image_url: null,
        sound: "default",
        link_id: null,
        data: {},
        audience: { type: "identifiers", recipients: ["user_1"] },
        control_group: null,
        conversion: null,
        variants: null,
        test_share: null,
        winner_after_minutes: null,
        winner_by: null,
      },
      { maxRetries: 0 },
    ]);
    await waitFor(() =>
      expect(POST).toHaveBeenCalledWith(
        `${BASE}/estimate`,
        { audience: { type: "identifiers", recipients: ["user_1"] } },
        expect.objectContaining({ maxRetries: 0 })
      )
    );
  });

  it("estimates reach with an empty title and body, without creating a draft", async () => {
    open();
    await addUserId("user_1");
    await waitFor(() =>
      expect(screen.getByLabelText("Estimated reach")).toHaveTextContent(
        "3devices"
      )
    );
    expect(POST).toHaveBeenCalledWith(
      `${BASE}/estimate`,
      { audience: { type: "identifiers", recipients: ["user_1"] } },
      expect.objectContaining({ maxRetries: 0 })
    );
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(createCalls()).toHaveLength(0);
  });

  it("never locks the reach card on a skeleton after a failed draft save", async () => {
    vi.mocked(PATCH).mockRejectedValue(new ApiError("Request timed out", 0));
    open("k9Qx2");
    await screen.findByLabelText("Title");
    await nav(/Audience/);
    await userEvent.type(
      screen.getByLabelText("User ids, one per line or comma-separated"),
      "{enter}user_2"
    );
    expect(
      await screen.findByText("Request timed out", {}, { timeout: 2000 })
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByLabelText("Estimated reach")).toHaveTextContent(
        "3devices"
      )
    );
    expect(
      screen.queryByRole("status", { name: "Calculating reach" })
    ).not.toBeInTheDocument();
  });

  it("creates with FormData when an image file is staged", async () => {
    const { container } = open();
    await fillMessage();
    const image = new File([new Uint8Array(10)], "hero.png", {
      type: "image/png",
    });
    await userEvent.upload(
      container.ownerDocument.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement,
      image
    );
    await addUserId("user_1");

    await waitFor(() => expect(createCalls()).toHaveLength(1), {
      timeout: 2000,
    });
    const body = createCalls()[0]![1] as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("image")).toBe(image);
    expect(body.get("name")).toBe("Hello");
    expect(body.getAll("audience[recipients][]")).toEqual(["user_1"]);
  });

  it("creates with an image and the experiment together", async () => {
    const { container } = open();
    await fillMessage();
    await userEvent.click(screen.getByRole("button", { name: "Add variant" }));
    await nav(/Experiment/);
    await userEvent.click(screen.getByRole("combobox", { name: "Test share" }));
    await userEvent.click(screen.getByRole("option", { name: "20%" }));
    await nav(/Message/);
    const image = new File([new Uint8Array(10)], "hero.png", {
      type: "image/png",
    });
    await userEvent.upload(
      container.ownerDocument.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement,
      image
    );
    await addUserId("user_1");
    await waitFor(() => expect(createCalls()).toHaveLength(1), {
      timeout: 2000,
    });
    const body = createCalls()[0]![1] as FormData;
    expect(body.get("image")).toBe(image);
    expect(body.get("test_share")).toBe("20");
    expect(body.get("control_group")).toBe("");
    expect(JSON.parse(body.get("variants") as string)).toEqual([
      { id: "b", title: "Hello", body: "World" },
    ]);
  });

  it("a test share is not offered with local-time delivery, and blocks the send", async () => {
    open("k9Qx2");
    await screen.findByLabelText("Title");
    await userEvent.click(screen.getByRole("button", { name: "Add variant" }));
    await nav(/Experiment/);
    await userEvent.click(screen.getByRole("combobox", { name: "Test share" }));
    await userEvent.click(screen.getByRole("option", { name: "20%" }));
    await nav(/Delivery/);
    await userEvent.click(screen.getByRole("radio", { name: "Schedule" }));
    await userEvent.click(
      screen.getByRole("switch", { name: "Deliver in each user's local time" })
    );
    await nav(/Experiment/);
    expect(screen.getByRole("combobox", { name: "Test share" })).toBeDisabled();
    expect(
      screen.getByText("Not available with local-time delivery.")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "A test share and local-time delivery can't be used together. Turn one of them off."
      )
    ).toBeInTheDocument();
  });

  it("local time switched on under Schedule does not block Send now", async () => {
    open("k9Qx2");
    await screen.findByLabelText("Title");
    await userEvent.click(screen.getByRole("button", { name: "Add variant" }));
    await nav(/Delivery/);
    await userEvent.click(screen.getByRole("radio", { name: "Schedule" }));
    await userEvent.click(
      screen.getByRole("switch", { name: "Deliver in each user's local time" })
    );
    await userEvent.click(screen.getByRole("radio", { name: "Send now" }));
    await nav(/Experiment/);
    expect(screen.getByRole("combobox", { name: "Test share" })).toBeEnabled();
    expect(
      screen.queryByText("Not available with local-time delivery.")
    ).toBeNull();
  });

  it("renames a draft whose name follows its title", async () => {
    stored = draftCampaign({ name: "Spring is here" });
    open("k9Qx2");
    await userEvent.type(await screen.findByLabelText("Title"), "!");
    await nav(/Audience/);

    await waitFor(() =>
      expect(PATCH).toHaveBeenCalledWith(
        `${BASE}/k9Qx2`,
        { name: "Spring is here!", title: "Spring is here!" },
        { maxRetries: 0 }
      )
    );
  });

  it("patches only what changed on a draft when switching sections", async () => {
    open("k9Qx2");
    await userEvent.type(await screen.findByLabelText("Title"), "!");
    await nav(/Audience/);

    // The fixture's name ("Spring") differs from its title, so it is never overwritten.
    await waitFor(() =>
      expect(PATCH).toHaveBeenCalledWith(
        `${BASE}/k9Qx2`,
        { title: "Spring is here!" },
        { maxRetries: 0 }
      )
    );

    await userEvent.type(
      screen.getByLabelText("User ids, one per line or comma-separated"),
      "{enter}user_2"
    );
    await waitFor(
      () =>
        expect(PATCH).toHaveBeenLastCalledWith(
          `${BASE}/k9Qx2`,
          {
            audience: { type: "identifiers", recipients: ["user_1", "user_2"] },
          },
          { maxRetries: 0 }
        ),
      { timeout: 2000 }
    );
    expect(createCalls()).toHaveLength(0);
  });

  it("saves a staged image on a draft as an image-only multipart PATCH, then closes", async () => {
    open("k9Qx2");
    await screen.findByLabelText("Title");
    const image = new File([new Uint8Array(10)], "hero.png", {
      type: "image/png",
    });
    await userEvent.upload(
      document.querySelector('input[type="file"]') as HTMLInputElement,
      image
    );
    await userEvent.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(PATCH).toHaveBeenCalledTimes(1);
    const form = vi.mocked(PATCH).mock.calls[0]![1] as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect([...form.keys()]).toEqual(["image"]);
  });

  it("cancels the pending autosave on a manual save: one create, one image upload", async () => {
    vi.mocked(POST).mockImplementation(async (path: string) => {
      if (path === BASE) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        return ok({ push_campaign: stored }, 201);
      }
      if (path.endsWith("/estimate")) return ok(estimateOf(3));
      return ok({});
    });
    open();
    await fillMessage();
    const image = new File([new Uint8Array(10)], "hero.png", {
      type: "image/png",
    });
    await userEvent.upload(
      document.querySelector('input[type="file"]') as HTMLInputElement,
      image
    );
    await addUserId("user_1");
    await screen.findByText(/^1 of 10,000/);
    await userEvent.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false), {
      timeout: 2000,
    });
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(createCalls()).toHaveLength(1);
    expect(createCalls()[0]![1]).toBeInstanceOf(FormData);
    expect(PATCH).not.toHaveBeenCalled();
  });

  it("never re-sends a failed create from the autosave timer", async () => {
    vi.mocked(POST).mockImplementation(async (path: string) => {
      if (path === BASE) throw new ApiError("Request timed out", 0);
      if (path.endsWith("/estimate")) return ok(estimateOf(1));
      return ok({});
    });
    open();
    await fillMessage();
    await addUserId("user_1");
    await screen.findByText(/^1 of 10,000/);
    await nav(/Delivery/);

    expect(await screen.findByText("Request timed out")).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 900));
    expect(createCalls()).toHaveLength(1);
  });

  it("keeps the saved text when the image upload fails, and retries only the image", async () => {
    vi.mocked(PATCH).mockImplementation(async (_path, body) => {
      if (body instanceof FormData)
        throw new ApiError("Image must be a PNG or JPEG", 422);
      return ok({ push_campaign: { ...stored, title: "Spring is here!" } });
    });
    open("k9Qx2");
    await userEvent.type(await screen.findByLabelText("Title"), "!");
    await userEvent.upload(
      document.querySelector('input[type="file"]') as HTMLInputElement,
      new File([new Uint8Array(10)], "hero.png", { type: "image/png" })
    );
    await userEvent.click(screen.getByRole("button", { name: "Save draft" }));

    expect(
      await screen.findByText("Image must be a PNG or JPEG")
    ).toBeInTheDocument();
    expect(PATCH).toHaveBeenCalledTimes(2);
    expect(vi.mocked(PATCH).mock.calls[0]![1]).toEqual({
      title: "Spring is here!",
    });
    expect(screen.getByLabelText("Title")).toHaveValue("Spring is here!");

    vi.mocked(PATCH).mockClear();
    vi.mocked(PATCH).mockResolvedValue(
      ok({ push_campaign: { ...stored, title: "Spring is here!" } })
    );
    await userEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(PATCH).toHaveBeenCalledTimes(1);
    const retry = vi.mocked(PATCH).mock.calls[0]![1] as FormData;
    expect(retry).toBeInstanceOf(FormData);
    expect([...retry.keys()]).toEqual(["image"]);
  });

  const noReach = () =>
    vi
      .mocked(POST)
      .mockImplementation(async (path: string) =>
        path.endsWith("/estimate") ? ok(estimateOf(0, 5)) : ok({})
      );

  it("blocks Send when no platform has push set up, but still saves drafts", async () => {
    configurations = [];
    noReach();
    open("k9Qx2");
    await screen.findByLabelText("Title");
    const send = screen.getByRole("button", { name: "Send now" });
    await waitFor(() => expect(send).toBeDisabled());
    expect(send).toHaveAccessibleDescription(
      "Set up iOS or Android push to send now"
    );
    const message = document.querySelector('[data-section="message"]')!;
    expect(message).not.toHaveTextContent("Set up push notifications");
    await nav(/Audience/);
    const audience = document.querySelector<HTMLElement>(
      '[data-section="audience"]'
    )!;
    const card = within(audience).getByRole("note", {
      name: "Set up push notifications",
    });
    expect(
      within(card).getByRole("link", { name: "Set up iOS push" })
    ).toHaveAttribute("target", "_blank");
    expect(audience.firstElementChild!.firstElementChild).toBe(card);
    expect(screen.getByRole("button", { name: "Save draft" })).toBeEnabled();
  });

  it("still allows scheduling when no platform has push set up", async () => {
    configurations = [];
    noReach();
    open("k9Qx2");
    await screen.findByLabelText("Title");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Send now" })).toBeDisabled()
    );
    await nav(/Delivery/);
    await userEvent.click(screen.getByRole("radio", { name: "Schedule" }));
    expect(screen.getByRole("button", { name: "Schedule…" })).toBeEnabled();
    expect(
      screen.queryByText("Set up iOS or Android push to send now")
    ).toBeNull();
  });

  it("does not block Send when the estimate reaches devices the config check missed", async () => {
    configurations = [];
    open("k9Qx2");
    await screen.findByLabelText("Title");
    await nav(/Audience/);
    await screen.findByRole("note", { name: "Set up push notifications" });
    await screen.findByText("will receive it", { exact: false });
    expect(screen.getByRole("button", { name: "Send now" })).toBeEnabled();
  });

  it("blocks Send again while a changed audience re-estimates", async () => {
    configurations = [];
    open("k9Qx2");
    await screen.findByLabelText("Title");
    await nav(/Audience/);
    await screen.findByText("will receive it", { exact: false });
    const send = screen.getByRole("button", { name: "Send now" });
    expect(send).toBeEnabled();

    vi.mocked(POST).mockImplementation(async (path: string) =>
      path.endsWith("/estimate") ? new Promise(() => {}) : ok({})
    );
    await userEvent.type(
      screen.getByLabelText("User ids, one per line or comma-separated"),
      "{enter}user_2"
    );
    await waitFor(() => expect(send).toBeDisabled());
  });

  it("refetches the setup on window focus and lifts the send block", async () => {
    configurations = [];
    noReach();
    open("k9Qx2");
    await screen.findByLabelText("Title");
    const send = screen.getByRole("button", { name: "Send now" });
    await waitFor(() => expect(send).toBeDisabled());

    configurations = BOTH_CONFIGURED;
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await waitFor(() => expect(send).toBeEnabled());
    expect(
      screen.queryByText("Set up push notifications")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Set up iOS or Android push to send now")
    ).toBeNull();
  });

  it("allows Send when one platform is set up, and notes the missing one", async () => {
    configurations = [(BOTH_CONFIGURED as unknown[])[0]];
    open("k9Qx2");
    await screen.findByLabelText("Title");
    await nav(/Audience/);
    const audience = document.querySelector<HTMLElement>(
      '[data-section="audience"]'
    )!;
    const notice = await within(audience).findByRole("note", {
      name: "Android push isn't configured",
    });
    expect(audience.firstElementChild!.firstElementChild).toBe(notice);
    expect(notice).toHaveTextContent(/^Android push isn't configured/);
    expect(notice).not.toHaveTextContent("won't receive campaigns");
    expect(
      within(notice).getByRole("link", { name: "Set up Android push" })
    ).toHaveAttribute("target", "_blank");
    expect(screen.queryByText("Set up push notifications")).toBeNull();
    expect(screen.getByRole("button", { name: "Send now" })).toBeEnabled();
  });

  it("does not block Send when the configurations fail to load", async () => {
    configurations = new ApiError("boom", 500);
    open("k9Qx2");
    await screen.findByLabelText("Title");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByRole("button", { name: "Send now" })).toBeEnabled();
    expect(
      screen.queryByText("Set up push notifications")
    ).not.toBeInTheDocument();
  });

  it("keeps Save draft disabled, with a hint, until the audience is valid", async () => {
    open();
    await fillMessage();
    const save = screen.getByRole("button", { name: "Save draft" });
    expect(save).toBeDisabled();
    expect(screen.getByText("Pick an audience to save a draft")).toBeVisible();
    expect(save).toHaveAccessibleDescription(
      "Pick an audience to save a draft"
    );

    await addUserId("user_1");
    await waitFor(() => expect(save).toBeEnabled());
    expect(
      screen.queryByText("Pick an audience to save a draft")
    ).not.toBeInTheDocument();
  });

  it("disables saving and sending while an uploaded image is removed", async () => {
    stored = draftCampaign({ image: "https://cdn.example/hero.png" });
    let finish: (value: unknown) => void = () => {};
    vi.mocked(DELETE).mockImplementation(
      () => new Promise((resolve) => (finish = resolve)) as never
    );
    open("k9Qx2");
    await screen.findByLabelText("Title");
    await userEvent.click(screen.getByRole("button", { name: "Remove image" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled()
    );
    expect(screen.getByRole("button", { name: "Send now" })).toBeDisabled();

    finish(ok({ push_campaign: { ...stored, image: null } }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save draft" })).toBeEnabled()
    );
  });

  it("selects a link created from + New link", async () => {
    open("k9Qx2");
    await screen.findByLabelText("Title");
    await userEvent.click(screen.getByRole("button", { name: "New link" }));
    expect(linkDialog.openLinkDialog).toHaveBeenCalledTimes(1);

    const { onSuccess } = linkDialog.openLinkDialog.mock.calls[0]![0] as {
      onSuccess: (link?: Link) => void;
    };
    onSuccess({ ...NEW_LINK, id: "4821" } as unknown as Link);
    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: "Deep link" })
      ).toHaveTextContent("Spring sale")
    );

    await userEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() =>
      expect(PATCH).toHaveBeenCalledWith(
        `${BASE}/k9Qx2`,
        { link_id: 4821 },
        { maxRetries: 0 }
      )
    );
  });

  it("does not send when the setup resolves to none while the confirmation is open", async () => {
    vi.mocked(POST).mockImplementation(async (path: string) =>
      path.endsWith("/estimate") ? ok(estimateOf(0, 5)) : ok({})
    );
    open("k9Qx2");
    await screen.findByLabelText("Title");
    const send = screen.getByRole("button", { name: "Send now" });
    await waitFor(() => expect(send).toBeEnabled());
    await userEvent.click(send);
    const dialog = await screen.findByRole("dialog", {
      name: "Send this campaign now?",
    });

    configurations = [];
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await waitFor(() => expect(send).toBeDisabled());
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Send now" })
    );
    expect(POST).not.toHaveBeenCalledWith(
      `${BASE}/k9Qx2/send`,
      expect.anything(),
      expect.anything()
    );
  });

  it("confirms, sends, closes and opens the report", async () => {
    open("k9Qx2");
    await screen.findByLabelText("Title");
    await waitFor(() =>
      expect(POST).toHaveBeenCalledWith(
        `${BASE}/estimate`,
        expect.anything(),
        expect.anything()
      )
    );
    await userEvent.click(screen.getByRole("button", { name: "Send now" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Send this campaign now?",
    });
    expect(within(dialog).getByText("Spring is here")).toBeInTheDocument();
    expect(within(dialog).getByText("1 user id")).toBeInTheDocument();
    expect(within(dialog).getByText("3 devices")).toBeInTheDocument();
    // Reach is the reachable count (3), not all matched devices (5).
    expect(within(dialog).queryByText("5 devices")).toBeNull();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Send now" })
    );

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith("/push/k9Qx2")
    );
    expect(POST).toHaveBeenCalledWith(
      `${BASE}/k9Qx2/send`,
      {},
      { maxRetries: 0 }
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("jumps to a custom sound left empty: opens Advanced, scrolls and focuses it", async () => {
    open("k9Qx2");
    await screen.findByLabelText("Title");
    await userEvent.click(screen.getByRole("button", { name: /Advanced/ }));
    await userEvent.click(screen.getByRole("combobox", { name: "Sound" }));
    await userEvent.click(
      await screen.findByRole("option", { name: "Custom…" })
    );
    await userEvent.click(screen.getByRole("button", { name: /Advanced/ }));
    await nav(/Delivery/);
    const scroll = vi.mocked(HTMLElement.prototype.scrollIntoView);
    scroll.mockClear();

    await userEvent.click(screen.getByRole("button", { name: "Send now" }));
    const input = await screen.findByLabelText("Sound file");
    await waitFor(() => expect(input).toHaveFocus());
    expect(screen.getByRole("button", { name: /Advanced/ })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    expect(scroll.mock.contexts).toContain(input);
    expect(
      screen.getByRole("heading", { name: "Message" })
    ).toBeInTheDocument();
  });

  it("maps a 422 on send to the owning section", async () => {
    vi.mocked(POST).mockImplementation(async (path: string) => {
      if (path.endsWith("/estimate")) return ok(estimateOf(3));
      if (path.endsWith("/send"))
        throw new ApiError("Scheduled at must be within 30 days", 422);
      return ok({});
    });
    open("k9Qx2");
    await screen.findByLabelText("Title");
    await userEvent.click(screen.getByRole("button", { name: "Send now" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Send this campaign now?",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Send now" })
    );

    expect(
      await screen.findByText("Scheduled at must be within 30 days")
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Send now" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Go to Delivery" })
    ).not.toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("opens the report when a send hits a 409 and the campaign already left draft", async () => {
    vi.mocked(POST).mockImplementation(async (path: string) => {
      if (path.endsWith("/estimate")) return ok(estimateOf(3));
      if (path.endsWith("/send")) {
        stored = draftCampaign({ status: "sent" });
        throw new ApiError("Campaign has already been sent", 409);
      }
      return ok({});
    });
    open("k9Qx2");
    await screen.findByLabelText("Title");
    await userEvent.click(screen.getByRole("button", { name: "Send now" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Send this campaign now?",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Send now" })
    );

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith("/push/k9Qx2")
    );
  });

  it("keeps the confirm closed until a schedule is valid", async () => {
    open("k9Qx2");
    await screen.findByLabelText("Title");
    await nav(/Delivery/);
    await userEvent.click(screen.getByRole("radio", { name: "Schedule" }));
    await userEvent.click(screen.getByRole("button", { name: "Schedule…" }));
    expect(
      await screen.findByText("Pick the date and time to send it.")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: "Schedule this campaign?" })
    ).not.toBeInTheDocument();
  });

  it("does not autosave message edits made right after opening", async () => {
    open("k9Qx2");
    await screen.findByLabelText("Title");
    await userEvent.type(screen.getByLabelText("Title"), "!");
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(PATCH).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(
      await screen.findByText("Discard unsaved changes?")
    ).toBeInTheDocument();
  });

  it("asks before closing with unsaved edits", async () => {
    open("k9Qx2");
    await screen.findByLabelText("Title");
    await userEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    onOpenChange.mockClear();

    await userEvent.type(screen.getByLabelText("Title"), "!");
    await userEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(
      await screen.findByText("Discard unsaved changes?")
    ).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("variants are written in the message step, and the test share appears once there is one", async () => {
    open();
    await fillMessage();
    await nav(/Experiment/);
    expect(
      screen.getByText(
        /if you add variants in the Message step, which version wins/
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Test share" })).toBeNull();
    await nav(/Message/);
    const bar = () => screen.getByRole("radiogroup", { name: "Variant" });
    expect(within(bar()).getByRole("radio", { name: "A" })).toHaveTextContent(
      "AHello"
    );
    await userEvent.click(screen.getByRole("button", { name: "Add variant" }));
    expect(within(bar()).getByRole("radio", { name: "B" })).toBeChecked();
    expect(screen.getByLabelText("Title")).toHaveValue("Hello");
    expect(screen.getByLabelText("Body")).toHaveValue("World");
    // Sections stay mounted: the message step and the experiment step both show the split.
    expect(screen.getAllByText("A 50% · B 50%")).toHaveLength(2);
    await userEvent.clear(screen.getByLabelText("Title"));
    await userEvent.type(screen.getByLabelText("Title"), "Hi");
    expect(screen.getByTestId("push-preview")).toHaveTextContent("Hi");
    expect(within(bar()).getByRole("radio", { name: "B" })).toHaveTextContent(
      "BHi"
    );
    await userEvent.click(within(bar()).getByRole("radio", { name: "A" }));
    expect(screen.getByLabelText("Title")).toHaveValue("Hello");
    expect(screen.getByTestId("push-preview")).toHaveTextContent("Hello");
    // C copies the active one.
    await userEvent.click(screen.getByRole("button", { name: "Add variant" }));
    expect(within(bar()).getByRole("radio", { name: "C" })).toBeChecked();
    expect(screen.queryByRole("button", { name: "Add variant" })).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "Remove variant C" })
    );
    expect(within(bar()).getByRole("radio", { name: "A" })).toBeChecked();
    expect(within(bar()).queryByRole("radio", { name: "C" })).toBeNull();

    await nav(/Experiment/);
    const share = screen.getByRole("combobox", { name: "Test share" });
    expect(share).toHaveTextContent("Everyone at once");
    await userEvent.click(share);
    await userEvent.click(screen.getByRole("option", { name: "20%" }));
    expect(
      screen.getByText(
        "20% get the variants now; the rest wait until you pick the winner."
      )
    ).toBeInTheDocument();
    // The timer only exists with a test share; conversions need a goal.
    const picker = screen.getByRole("combobox", { name: "Pick the winner" });
    expect(picker).toHaveTextContent("Myself, from the report");
    expect(screen.queryByRole("combobox", { name: "Judge by" })).toBeNull();
    await userEvent.click(picker);
    await userEvent.click(
      screen.getByRole("option", { name: "Automatically after 2 hours" })
    );
    expect(
      screen.getByRole("combobox", { name: "Judge by" })
    ).toHaveTextContent("Opens");
    await userEvent.click(screen.getByRole("combobox", { name: "Judge by" }));
    expect(screen.getByRole("option", { name: "Conversions" })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
    await userEvent.keyboard("{Escape}");
    expect(
      screen.getByText(
        /If any variant has fewer than 100 people by then, A goes\. Set a goal first to judge by conversions/
      )
    ).toBeInTheDocument();

    await addUserId("user_1");
    await waitFor(() => expect(createCalls()).toHaveLength(1), {
      timeout: 2000,
    });
    // With a reach, the split and the test share say it in people (3 reachable).
    await nav(/Experiment/);
    expect(
      await screen.findByText(
        "20% (about 1 person) get the variants now; the rest wait until you pick the winner."
      )
    ).toBeInTheDocument();
    expect(screen.getAllByText("A 50% (2) · B 50% (2)")).toHaveLength(2);
    expect(createCalls()[0]![1]).toMatchObject({
      control_group: null,
      conversion: null,
      variants: [{ id: "b", title: "Hi", body: "World" }],
      test_share: 20,
      winner_after_minutes: 120,
      winner_by: "opens",
    });
  });

  it("a goal can be a built-in event", async () => {
    open("k9Qx2");
    await screen.findByLabelText("Title");
    await nav(/Experiment/);
    await userEvent.click(
      screen.getByRole("combobox", { name: "Count as a conversion" })
    );
    await userEvent.click(
      screen.getByRole("option", { name: "A built-in event" })
    );
    await userEvent.click(
      screen.getByRole("combobox", { name: "Goal built-in event" })
    );
    await userEvent.click(
      screen.getByRole("option", { name: "App installed" })
    );
    expect(
      screen.getByText("Recorded by the SDK in every app.")
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(PATCH).toHaveBeenCalled());
    expect(vi.mocked(PATCH).mock.calls[0]![1]).toMatchObject({
      conversion: { system: "install", window_hours: 72 },
    });
  });

  it("a variant with no title stops the send on its pill, and the confirm names the experiment", async () => {
    open("k9Qx2");
    await screen.findByLabelText("Title");
    await userEvent.click(screen.getByRole("button", { name: "Add variant" }));
    await userEvent.clear(screen.getByLabelText("Title"));
    await nav(/Experiment/);
    const control = screen.getByRole("combobox", { name: "Control group" });
    await userEvent.click(control);
    await userEvent.click(
      screen.getByRole("option", { name: "10% held back" })
    );
    await nav(/Delivery/);
    await userEvent.click(screen.getByRole("button", { name: "Send now" }));
    expect(
      screen.getByRole("heading", { name: "Message" })
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "B" })).toBeChecked();
    expect(
      screen.getByText("Add a title: the bold first line people see.")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: "Send this campaign now?" })
    ).toBeNull();
    await userEvent.type(screen.getByLabelText("Title"), "Hi");
    await userEvent.click(screen.getByRole("button", { name: "Send now" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Send this campaign now?",
    });
    expect(
      within(dialog).getByText("10% control group · 1 variant")
    ).toBeInTheDocument();
  });

  it("does not open the composer for a campaign that already left draft", async () => {
    stored = draftCampaign({ status: "scheduled" });
    open("k9Qx2");
    expect(
      await screen.findByText(
        "This campaign is no longer a draft, so it cannot be edited."
      )
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
  });
});
