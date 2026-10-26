import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/lib/ApiError";
import { inAppApi } from "@ee/api/in_app/inAppService";
import {
  ok,
  polyfillDom,
  wrap,
} from "@ee/components/push/composer/__tests__/helpers";
import { inAppCampaign } from "@ee/lib/__tests__/inAppFixtures";
import {
  draftFromCampaign,
  draftProblems,
  quickQuestionDraft,
  updateDraft,
} from "@ee/lib/inAppComposer";
import InAppComposer from "../composer/InAppComposer";
import { previewText } from "../composer/MessagePreview";
import { toPayload } from "../composer/ActionEditor";
import { GALLERY } from "@ee/lib/inAppHtmlGallery";

vi.mock("@ee/api/in_app/inAppService", () => ({
  inAppApi: {
    create: vi.fn(),
    update: vi.fn(),
    step: vi.fn(),
    test: vi.fn(),
    uploadImage: vi.fn(),
    removeImage: vi.fn(),
    media: vi.fn(),
    uploadMedia: vi.fn(),
    removeMedia: vi.fn(),
  },
}));
vi.mock("@ee/hooks/queries/useSegmentsQueries", () => ({
  useSegmentsQuery: () => ({ data: { segments: [] } }),
}));
vi.mock("@ee/hooks/queries/useInAppSuggestions", () => ({
  useInAppSuggestions: () => ({
    loading: false,
    userAttributes: ["first_name", "plan"],
    eventProperties: ["total"],
  }),
}));
vi.mock("@ee/components/segments/builder/ValuePicker", () => ({
  default: ({
    ariaLabel,
    field,
    values,
    exclude,
    onChange,
  }: {
    ariaLabel: string;
    field: string;
    values: string[];
    exclude?: string[];
    onChange: (values: string[]) => void;
  }) => (
    <button
      type="button"
      data-field={field}
      data-exclude={(exclude ?? []).join(",")}
      onClick={() =>
        onChange(
          values.length
            ? []
            : [field === "screen_name" ? "Checkout" : "checkout"]
        )
      }
    >
      {ariaLabel}
    </button>
  ),
}));
vi.mock("@ee/components/audience/SegmentSelect", () => ({
  default: ({ onChange }: { onChange: (id: string) => void }) => (
    <button type="button" onClick={() => onChange("s1")}>
      Pick segment
    </button>
  ),
}));
const notify = vi.hoisted(() => ({ ok: vi.fn(), bad: vi.fn() }));
vi.mock("@/lib/Notifications", () => ({
  showSuccessNotification: notify.ok,
  showErrorNotification: notify.bad,
}));

const api = vi.mocked(inAppApi);
const onClose = vi.fn();

function open(props: Partial<Parameters<typeof InAppComposer>[0]> = {}) {
  const closeRef = { current: null as (() => void) | null };
  wrap(
    <InAppComposer
      projectId="p1"
      closeRef={closeRef}
      onClose={onClose}
      {...props}
    />
  );
  return closeRef;
}

const go = (name: string) =>
  userEvent.click(screen.getByRole("button", { name: new RegExp(name) }));
const saved = (over = {}) => ok({ in_app_campaign: inAppCampaign(over) });

beforeEach(() => {
  vi.clearAllMocks();
  polyfillDom();
  URL.createObjectURL = vi.fn(() => "blob:chosen");
  URL.revokeObjectURL = vi.fn();
  api.create.mockResolvedValue(saved() as never);
  api.update.mockResolvedValue(saved() as never);
  api.step.mockResolvedValue(saved({ status: "live" }) as never);
});

async function fillMessage() {
  await userEvent.type(screen.getByLabelText("Title"), "Hello");
}

describe("InAppComposer", () => {
  it("creates a draft, then updates the same one", async () => {
    open();
    await fillMessage();
    await go("Save draft");
    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
    expect(api.create.mock.calls[0]![1]).toMatchObject({
      name: "Hello",
      content: { title: "Hello" },
      triggers: [{ type: "app_open" }],
      audience: { type: "all" },
    });
    await userEvent.type(screen.getByLabelText("Message"), "Welcome");
    await go("Save draft");
    await waitFor(() => expect(api.update).toHaveBeenCalledTimes(1));
    expect(api.update.mock.calls[0]![1]).toBe("LXyFdO");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("walks the six steps and shows what will launch", async () => {
    open();
    await fillMessage();
    for (const step of [
      "Trigger",
      "Audience",
      "Experiment",
      "Limits and schedule",
      "Check and launch",
    ]) {
      await go("Next");
      expect(screen.getByRole("heading", { name: step })).toBeInTheDocument();
    }
    expect(screen.getByText("The app is opened")).toBeInTheDocument();
    expect(screen.getByText("Everyone")).toBeInTheDocument();
    expect(screen.getByText("1 per session")).toBeInTheDocument();
    expect(
      screen.getByText("At any time of day, every day.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
  });

  it("launch saves, asks, launches and closes", async () => {
    open();
    await fillMessage();
    await go("Check and launch");
    await go("Launch");
    expect(
      await screen.findByText("Launch this campaign?")
    ).toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: "Launch" });
    await userEvent.click(buttons[buttons.length - 1]!);
    await waitFor(() =>
      expect(api.step).toHaveBeenCalledWith("p1", "LXyFdO", "launch")
    );
    expect(api.create).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(notify.ok).toHaveBeenCalledWith("The campaign is live");
  });

  it("does not launch a draft with problems, and goes to the first one", async () => {
    open();
    await go("Check and launch");
    await go("Launch");
    expect(api.create).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "Message" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("The message has no text yet. Add a title or a message.")
    ).toBeInTheDocument();
  });

  it("the name is optional and asked for last", async () => {
    open();
    await fillMessage();
    expect(screen.queryByLabelText(/Name in your list/)).toBeNull();
    await go("Check and launch");
    const name = screen.getByLabelText(/Name in your list/);
    expect(name).toHaveAttribute("placeholder", "Hello");
    await userEvent.type(name, "Autumn sale");
    await go("Save draft");
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    expect(api.create.mock.calls[0]![1].name).toBe("Autumn sale");
  });

  it("review links back to the step that holds each part", async () => {
    open();
    await fillMessage();
    await go("Check and launch");
    await userEvent.click(screen.getByRole("button", { name: "Edit trigger" }));
    expect(
      screen.getByRole("heading", { name: "Trigger" })
    ).toBeInTheDocument();
  });

  it("inserts a recorded attribute, with its fallback, into the title", async () => {
    open();
    await userEvent.type(screen.getByLabelText("Title"), "Hi ");
    await userEvent.click(
      screen.getByRole("button", { name: "Insert a value into the title" })
    );
    const insert = screen.getByRole("button", { name: "Insert" });
    expect(insert).toBeDisabled();
    await userEvent.click(await screen.findByText("first_name"));
    await userEvent.type(screen.getByLabelText(/Fallback text/), "there");
    expect(screen.getByLabelText("Title")).toHaveValue("Hi ");
    await userEvent.click(insert);
    expect(screen.getByLabelText("Title")).toHaveValue(
      'Hi {{ user.first_name | default: "there" }}'
    );
    expect(screen.getByTestId("in-app-preview-card")).toHaveTextContent(
      "Hi there"
    );
  });

  it("a template is picked from a list with pictures, and an image one drops the text", async () => {
    open();
    await userEvent.click(screen.getByRole("combobox", { name: "Template" }));
    expect(screen.getAllByRole("option")).toHaveLength(10);
    await userEvent.click(screen.getByRole("option", { name: /Cover image/ }));
    expect(screen.queryByLabelText("Title")).toBeNull();
    expect(
      screen.getByRole("combobox", { name: "Template" })
    ).toHaveTextContent("Cover image");
    expect(screen.queryByText("Dim the app behind the message")).toBeNull();
  });

  it("an alert counts its text, flags what is too long, and switches to Interstitial keeping it", async () => {
    open();
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "t".repeat(81) },
    });
    expect(screen.queryByText("81 / 80")).toBeNull();
    expect(screen.queryByText(/Alerts are for short messages/)).toBeNull();
    await userEvent.click(screen.getByRole("combobox", { name: "Template" }));
    await userEvent.click(screen.getByRole("option", { name: /^Alert/ }));
    expect(screen.getByText("81 / 80")).toBeInTheDocument();
    expect(screen.getByText("0 / 300")).toBeInTheDocument();
    expect(
      screen.getByText(
        "The alert title is too long: it can have at most 80 characters."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Alerts are for short messages/)
    ).toBeInTheDocument();
    await go("Add button");
    fireEvent.change(screen.getByLabelText("Button 1 label"), {
      target: { value: "b".repeat(31) },
    });
    expect(screen.getByText("31 / 30")).toBeInTheDocument();
    await go("Switch to Interstitial");
    expect(
      screen.getByRole("combobox", { name: "Template" })
    ).toHaveTextContent("Interstitial");
    expect(screen.getByLabelText("Title")).toHaveValue("t".repeat(81));
    expect(screen.getByLabelText("Button 1 label")).toHaveValue("b".repeat(31));
    expect(screen.queryByText("81 / 80")).toBeNull();
    expect(screen.queryByText(/an alert/i)).toBeNull();
  });

  it("colours stay folded away until asked for", async () => {
    open();
    expect(screen.getByRole("button", { name: /Colours/ })).toHaveTextContent(
      "Light theme"
    );
    expect(screen.queryByRole("radio", { name: "Dark" })).toBeNull();
    await go("Colours");
    expect(screen.getByRole("radio", { name: "Dark" })).toBeInTheDocument();
  });

  it("a theme sets every colour, and the preview follows", async () => {
    open();
    await fillMessage();
    await go("Add button");
    await go("Colours");
    await userEvent.click(screen.getByRole("radio", { name: "Dark" }));
    expect(
      screen.getByRole("button", { name: "Background: #111827" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Colours/ })).toHaveTextContent(
      "Dark theme"
    );
    expect(screen.getByTestId("in-app-preview-card")).toHaveStyle({
      backgroundColor: "#111827",
    });
    await userEvent.type(screen.getByLabelText("Button 1 label"), "Shop");
    await go("Save draft");
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    expect(api.create.mock.calls[0]![1].content).toMatchObject({
      colors: { background: "#111827", title: "#FFFFFF", message: "#D1D5DB" },
      buttons: [{ colors: { background: "#FFFFFF", text: "#111827" } }],
    });
    await userEvent.click(screen.getByRole("radio", { name: "Light" }));
    expect(
      screen.getByRole("button", { name: "Background: automatic" })
    ).toBeInTheDocument();
  });

  it("one colour is picked from the palette, typed, or put back to automatic", async () => {
    open();
    await fillMessage();
    await go("Colours");
    await userEvent.click(
      screen.getByRole("button", { name: "Title: automatic" })
    );
    await userEvent.click(screen.getByRole("option", { name: "#EF4444" }));
    expect(screen.getByRole("button", { name: /Colours/ })).toHaveTextContent(
      "Your own colours"
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Background: automatic" })
    );
    const code = screen.getByLabelText("Background code");
    await userEvent.type(code, "#12");
    expect(code).toHaveAttribute("aria-invalid", "true");
    await userEvent.type(code, "3456");
    await userEvent.keyboard("{Escape}");
    await go("Save draft");
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    expect(api.create.mock.calls[0]![1].content?.colors).toEqual({
      background: "#123456",
      title: "#EF4444",
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Title: #EF4444" })
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Back to automatic" })
    );
    expect(
      screen.getByRole("button", { name: "Title: automatic" })
    ).toBeInTheDocument();
  });

  it("a message that must be answered has no close button and needs something to tap", async () => {
    open();
    await fillMessage();
    await userEvent.click(
      screen.getByRole("switch", {
        name: /People can close it without answering/,
      })
    );
    expect(
      screen.queryByRole("switch", { name: "Show a close button" })
    ).toBeNull();
    await go("Check and launch");
    expect(
      screen.getByText(
        'People have no way to close this message. Add a button or a tap action, or turn on "People can close it without answering".'
      )
    ).toBeInTheDocument();
  });

  it("the update message opens ready-made, and asks before it is thrown away", async () => {
    const closeRef = open({ preset: updateDraft() });
    expect(screen.getByLabelText("Title")).toHaveValue(
      "A new version is ready"
    );
    expect(screen.getByLabelText("Button 1 label")).toHaveValue("Update");
    expect(screen.getAllByText(/Apps only/)).toHaveLength(1);
    closeRef.current?.();
    expect(
      await screen.findByText("Close without saving?")
    ).toBeInTheDocument();
  });

  it("a delay is chosen with the trigger and sent", async () => {
    open({ initial: inAppCampaign({ delay_seconds: 5 }) });
    await go("Trigger");
    expect(screen.getByRole("combobox", { name: "Delay" })).toHaveTextContent(
      "After 5 seconds"
    );
    await go("Save draft");
    await waitFor(() => expect(api.update).toHaveBeenCalled());
    expect(api.update.mock.calls[0]![2].delay_seconds).toBe(5);
  });

  it("an orientation is chosen with the limits, sent, and summed up", async () => {
    open({
      initial: inAppCampaign({
        content: { title: "Hi", orientation: "landscape" },
      }),
    });
    await go("Limits and schedule");
    expect(
      screen.getByRole("combobox", { name: "Orientation" })
    ).toHaveTextContent("Landscape only");
    await go("Check and launch");
    expect(screen.getByText("Landscape only")).toBeInTheDocument();
    await go("Save draft");
    await waitFor(() => expect(api.update).toHaveBeenCalled());
    expect(api.update.mock.calls[0]![2].content?.orientation).toBe("landscape");
  });

  it("hours are all day or between two times picked from the list", async () => {
    open();
    await fillMessage();
    await go("Limits and schedule");
    await userEvent.click(screen.getByRole("switch", { name: /certain days/ }));
    const hours = screen.getByRole("combobox", { name: "Hours" });
    expect(hours).toHaveTextContent("Between");
    expect(screen.getByRole("combobox", { name: "From" })).toHaveTextContent(
      "09:00"
    );
    expect(screen.getByRole("combobox", { name: "To" })).toHaveTextContent(
      "21:00"
    );
    await userEvent.click(screen.getByRole("combobox", { name: "To" }));
    await userEvent.click(screen.getByRole("option", { name: "18:00" }));
    await go("Save draft");
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    expect(api.create.mock.calls[0]![1].schedule).toEqual({
      days: [1, 2, 3, 4, 5],
      from: "09:00",
      to: "18:00",
    });
    await userEvent.click(hours);
    await userEvent.click(screen.getByRole("option", { name: "All day" }));
    expect(screen.queryByRole("combobox", { name: "From" })).toBeNull();
  });

  it("an empty variant A is named, and Fix takes you to it", async () => {
    open();
    await fillMessage();
    await go("Add variant");
    await userEvent.click(screen.getByRole("radio", { name: "A" }));
    await userEvent.clear(screen.getByLabelText("Title"));
    await userEvent.clear(screen.getByLabelText("Message"));
    await userEvent.click(screen.getByRole("radio", { name: "B" }));
    await go("Check and launch");
    const problem =
      "Variant A: The message has no text yet. Add a title or a message.";
    expect(screen.getByText(problem)).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: `Fix: ${problem}` })
    );
    expect(
      screen.getByRole("heading", { name: "Message" })
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "A" })).toBeChecked();
  });

  it("a tap on the message does nothing unless an action is chosen", async () => {
    open();
    await fillMessage();
    expect(
      screen.getByRole("combobox", { name: "Tap action" })
    ).toHaveTextContent("Nothing");
    await go("Save draft");
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    expect(api.create.mock.calls[0]![1].content?.tap_action).toBeNull();
  });

  it("has no back button and no note about unsaved changes", async () => {
    open();
    await fillMessage();
    await go("Next");
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    expect(screen.queryByText(/unsaved changes/)).toBeNull();
  });

  it("review says in a sentence what launching does", async () => {
    open();
    await fillMessage();
    await go("Check and launch");
    expect(screen.getByText("Ready to launch")).toBeInTheDocument();
    expect(
      screen.getByText(
        "An interstitial shown to everyone when the app is opened, as soon as it is launched."
      )
    ).toBeInTheDocument();
  });

  it("review lists what is missing instead", async () => {
    open();
    await go("Check and launch");
    expect(screen.getByText("Not ready to launch yet")).toBeInTheDocument();
    expect(
      screen.getByText("The message has no text yet. Add a title or a message.")
    ).toBeInTheDocument();
  });

  it("a screen trigger takes a screen the app has reported", async () => {
    open();
    await fillMessage();
    await go("Trigger");
    await userEvent.click(
      screen.getByRole("radio", { name: /A screen is viewed/ })
    );
    await go("Trigger 1 screen name");
    await go("Save draft");
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    expect(api.create.mock.calls[0]![1].triggers).toEqual([
      { type: "screen_view", name: "Checkout" },
    ]);
  });

  it("shows the server's reason when it refuses the launch", async () => {
    api.step.mockRejectedValue(
      new ApiError("Invalid", 422, undefined, {
        error: "A project can run 50 campaigns at once",
      })
    );
    open();
    await fillMessage();
    await go("Check and launch");
    await go("Launch");
    const buttons = await screen.findAllByRole("button", { name: "Launch" });
    await userEvent.click(buttons[buttons.length - 1]!);
    expect(
      await screen.findByText("A project can run 50 campaigns at once")
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("a member can launch too", async () => {
    open();
    await fillMessage();
    await go("Check and launch");
    await go("Launch");
    const buttons = await screen.findAllByRole("button", { name: "Launch" });
    await userEvent.click(buttons[buttons.length - 1]!);
    await waitFor(() =>
      expect(api.step).toHaveBeenCalledWith("p1", "LXyFdO", "launch")
    );
  });

  it("a launched campaign keeps its template and audience, and saves as changes", async () => {
    api.update.mockResolvedValue(
      saved({
        status: "live",
        launched_at: "2026-09-28T10:00:00.000Z",
      }) as never
    );
    open({
      initial: inAppCampaign({
        status: "live",
        launched_at: "2026-09-28T10:00:00.000Z",
      }),
    });
    expect(screen.getByRole("combobox", { name: "Template" })).toBeDisabled();
    await userEvent.clear(screen.getByLabelText("Title"));
    await userEvent.type(screen.getByLabelText("Title"), "New title");
    await go("Save changes");
    await waitFor(() => expect(api.update).toHaveBeenCalled());
    const input = api.update.mock.calls[0]![2];
    expect(input).toMatchObject({ content: { title: "New title" } });
    expect(input).not.toHaveProperty("audience");
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    await go("Check and launch");
    expect(screen.queryByRole("button", { name: "Launch" })).toBeNull();
  });

  it("a launched campaign with problems is not saved", async () => {
    open({
      initial: inAppCampaign({
        status: "live",
        launched_at: "2026-09-28T10:00:00.000Z",
        content: { title: "Hello" },
      }),
    });
    await userEvent.clear(screen.getByLabelText("Title"));
    await go("Save changes");
    expect(api.update).not.toHaveBeenCalled();
    expect(
      screen.getByText("The message has no text yet. Add a title or a message.")
    ).toBeInTheDocument();
  });

  it("an upload saves the draft first and keeps what was typed since", async () => {
    api.uploadImage.mockResolvedValue(
      saved({
        content: {
          title: "Stale title from the server",
          image: { portrait: "https://cdn.example/a.png", landscape: null },
        },
      }) as never
    );
    open();
    await fillMessage();
    const file = new File(["x"], "a.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Choose portrait image"), {
      target: { files: [file] },
    });
    await waitFor(() =>
      expect(api.uploadImage).toHaveBeenCalledWith(
        "p1",
        "LXyFdO",
        "portrait",
        file
      )
    );
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByRole("button", { name: "Remove portrait image" })
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("in-app-preview-card").querySelector("img")
    ).toHaveAttribute("src", "blob:chosen");
    expect(screen.getByLabelText("Title")).toHaveValue("Hello");
  });

  it("refuses a file that is too large or not an image before sending it", async () => {
    open();
    const big = new File([new Uint8Array(1024 * 1024 + 1)], "a.png", {
      type: "image/png",
    });
    fireEvent.change(screen.getByLabelText("Choose portrait image"), {
      target: { files: [big] },
    });
    expect(
      await screen.findByText("The image must be under 1 MB.")
    ).toBeInTheDocument();
    const pdf = new File(["x"], "a.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Choose portrait image"), {
      target: { files: [pdf] },
    });
    expect(
      await screen.findByText("The image must be a PNG, JPEG or GIF.")
    ).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();
    expect(api.uploadImage).not.toHaveBeenCalled();
  });

  it("adds at most two buttons and sends their actions", async () => {
    open();
    await fillMessage();
    await go("Add button");
    await go("Add button");
    expect(screen.queryByRole("button", { name: /Add button/ })).toBeNull();
    await userEvent.type(screen.getByLabelText("Button 1 label"), "Shop");
    await userEvent.type(screen.getByLabelText("Button 2 label"), "Later");
    await go("Save draft");
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    expect(api.create.mock.calls[0]![1].content?.buttons).toEqual([
      { id: "button_1", text: "Shop", action: { type: "close" } },
      { id: "button_2", text: "Later", action: { type: "close" } },
    ]);
  });

  it("a segment audience sends the segment that was picked", async () => {
    open();
    await fillMessage();
    await go("Audience");
    await userEvent.click(
      screen.getByRole("radio", { name: /People in a segment/ })
    );
    await go("Pick segment");
    await go("Save draft");
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    expect(api.create.mock.calls[0]![1].audience).toEqual({
      type: "segment",
      segment_id: "s1",
    });
  });

  it("asks before closing with unsaved changes, and not without", async () => {
    const closeRef = open();
    closeRef.current?.();
    expect(onClose).toHaveBeenCalledTimes(1);
    await userEvent.type(screen.getByLabelText("Title"), "Hello");
    closeRef.current?.();
    expect(
      await screen.findByRole("dialog", { name: "Close without saving?" })
    ).toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("the preview shows the text with its fallback", async () => {
    open();
    await userEvent.type(screen.getByLabelText("Title"), "Hi there");
    expect(screen.getByTestId("in-app-preview-card")).toHaveTextContent(
      "Hi there"
    );
  });

  it("still asks before closing when something was typed while a save was on its way", async () => {
    let finish: (value: unknown) => void = () => undefined;
    api.create.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }) as never
    );
    const closeRef = open();
    await fillMessage();
    await go("Save draft");
    await userEvent.type(screen.getByLabelText("Message"), "More");
    finish(saved());
    await waitFor(() => expect(notify.ok).toHaveBeenCalled());
    closeRef.current?.();
    expect(await screen.findByText(/discard/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("cannot be saved or launched while a picture is uploading", async () => {
    api.uploadImage.mockReturnValue(new Promise(() => undefined) as never);
    open({ initial: inAppCampaign() });
    const file = new File(["x"], "a.png", { type: "image/png" });
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input!, { target: { files: [file] } });
    await waitFor(() => expect(api.uploadImage).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: /Save/ })).toBeDisabled();
    fireEvent.change(input!, { target: { files: [file] } });
    expect(api.uploadImage).toHaveBeenCalledTimes(1);
  });

  it("does not save a segment audience with no segment picked, which would come back as everyone", async () => {
    open();
    await fillMessage();
    await go("Audience");
    await userEvent.click(screen.getByText(/People in a segment/));
    await go("Save draft");
    expect(api.create).not.toHaveBeenCalled();
    expect(
      await screen.findByText(
        "Pick the segment to show it to, or choose Everyone."
      )
    ).toBeInTheDocument();
  });

  it("sends the version the last save returned", async () => {
    api.create.mockResolvedValue(saved({ lock_version: 3 }) as never);
    open();
    await fillMessage();
    await go("Save draft");
    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
    expect(api.create.mock.calls[0]![1].lock_version).toBeUndefined();
    await userEvent.type(screen.getByLabelText("Message"), "More");
    await go("Save draft");
    await waitFor(() => expect(api.update).toHaveBeenCalledTimes(1));
    expect(api.update.mock.calls[0]![2].lock_version).toBe(3);
  });

  it("sends the version editing started from, not a newer one a refetch brought in", async () => {
    const client = new QueryClient();
    const closeRef = { current: null as (() => void) | null };
    const ui = (lock_version: number) => (
      <QueryClientProvider client={client}>
        <InAppComposer
          projectId="p1"
          closeRef={closeRef}
          onClose={onClose}
          initial={inAppCampaign({ lock_version })}
        />
      </QueryClientProvider>
    );
    const { rerender } = render(ui(2));
    // Someone else saved meanwhile; the open composer must not adopt their version.
    rerender(ui(5));
    await userEvent.type(screen.getByLabelText("Title"), "!");
    await go("Save draft");
    await waitFor(() => expect(api.update).toHaveBeenCalledTimes(1));
    expect(api.update.mock.calls[0]![2].lock_version).toBe(2);
  });

  it("the launch confirmation says it is launching while it waits", async () => {
    let finish: (v: unknown) => void = () => {};
    api.step.mockReturnValue(new Promise((done) => (finish = done)) as never);
    open();
    await fillMessage();
    await go("Check and launch");
    await go("Launch");
    const buttons = await screen.findAllByRole("button", { name: "Launch" });
    await userEvent.click(buttons[buttons.length - 1]!);
    expect(await screen.findByText("Launching...")).toBeInTheDocument();
    expect(screen.queryByText("Deleting...")).toBeNull();
    finish(saved({ status: "live" }));
  });

  it("an alert people cannot close needs a button, not a tap action", () => {
    const problems = draftProblems({
      ...draftFromCampaign(inAppCampaign()),
      template: "alert",
      dismissible: false,
      buttons: [],
      tapAction: { type: "close" },
    });
    expect(problems.message).toContain(
      'People have no way to close this alert. Add a button, or turn on "People can close it without answering".'
    );
  });

  it("sends a test to a person, saving the draft first", async () => {
    api.test.mockResolvedValue(ok({ devices: 2 }) as never);
    open();
    await fillMessage();
    await go("Check and launch");
    const send = screen.getByRole("button", { name: "Send test" });
    expect(send).toBeDisabled();
    await userEvent.type(screen.getByLabelText("See it on a device"), " ana ");
    await userEvent.click(send);
    await waitFor(() => expect(api.test).toHaveBeenCalledTimes(1));
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.test.mock.calls[0]!.slice(1)).toEqual(["LXyFdO", "ana"]);
    expect(notify.ok).toHaveBeenCalledWith(
      "Sent to 2 devices. Open the app to see it."
    );
  });

  it("shows why a test could not be sent", async () => {
    api.test.mockRejectedValue(
      new ApiError("Invalid", 422, undefined, {
        error: "Nobody in this project has that identifier",
      })
    );
    open({ initial: inAppCampaign() });
    await go("Check and launch");
    await userEvent.type(screen.getByLabelText("See it on a device"), "bob");
    await go("Send test");
    expect(
      await screen.findByText("Nobody in this project has that identifier")
    ).toBeInTheDocument();
  });

  it("never saves a launched campaign in order to send a test", async () => {
    api.test.mockResolvedValue(ok({ devices: 1 }) as never);
    open({ initial: inAppCampaign({ status: "live" }) });
    await userEvent.type(screen.getByLabelText("Title"), " edited");
    await go("Check and launch");
    await userEvent.type(screen.getByLabelText("See it on a device"), "ana");
    await go("Send test");
    expect(
      await screen.findByText(/Save your changes first/)
    ).toBeInTheDocument();
    expect(api.update).not.toHaveBeenCalled();
    expect(api.test).not.toHaveBeenCalled();
  });

  it("offers a test to members too", async () => {
    open();
    await fillMessage();
    await go("Check and launch");
    expect(screen.getByText("See it on a device")).toBeInTheDocument();
  });
});

describe("the experiment step", () => {
  const live = { status: "live" as const, launched_at: "2026-09-28T10:00:00Z" };

  it("a goal is an event with a window, and goes with the event", async () => {
    open();
    await fillMessage();
    await go("Experiment");
    expect(screen.getByText(/No goal\./)).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Conversion window" })
    ).toBeNull();
    // The message's own events are never offered as a goal.
    expect(screen.getByRole("button", { name: "Goal event" })).toHaveAttribute(
      "data-exclude",
      expect.stringContaining("in_app_viewed,in_app_clicked")
    );
    await go("Goal event");
    expect(
      screen.getByText(/Seeing or answering the message never counts/)
    ).toBeInTheDocument();
    const window = screen.getByRole("combobox", { name: "Conversion window" });
    expect(window).toHaveTextContent("within 3 days");
    await userEvent.click(window);
    await userEvent.click(
      screen.getByRole("option", { name: "within 7 days" })
    );
    await go("Save draft");
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    expect(api.create.mock.calls[0]![1].conversion).toEqual({
      event: "checkout",
      window_hours: 168,
    });
    await go("Check and launch");
    expect(screen.getByText("checkout within 7 days")).toBeInTheDocument();
  });

  it("a goal can be a screen instead, and switching the kind clears the name", async () => {
    open();
    await fillMessage();
    await go("Experiment");
    const kind = screen.getByRole("combobox", {
      name: "Count as a conversion",
    });
    expect(kind).toHaveTextContent("A custom event");
    await userEvent.click(kind);
    await userEvent.click(screen.getByRole("option", { name: "A screen" }));
    const picker = screen.getByRole("button", { name: "Goal screen" });
    expect(picker).toHaveAttribute("data-field", "screen_name");
    expect(picker).toHaveAttribute("data-exclude", "");
    await userEvent.click(picker);
    expect(
      screen.getByText("The screens your app reports.")
    ).toBeInTheDocument();
    await go("Check and launch");
    expect(
      screen.getByText("the Checkout screen within 3 days")
    ).toBeInTheDocument();
    await go("Save draft");
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    expect(api.create.mock.calls[0]![1].conversion).toEqual({
      screen: "Checkout",
      window_hours: 72,
    });
    await go("Edit experiment");
    await userEvent.click(
      screen.getByRole("combobox", { name: "Count as a conversion" })
    );
    await userEvent.click(
      screen.getByRole("option", { name: "A custom event" })
    );
    expect(screen.getByText(/No goal\./)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Goal event" })
    ).toBeInTheDocument();
  });

  it("a goal can be a built-in event", async () => {
    open();
    await fillMessage();
    await go("Experiment");
    await userEvent.click(
      screen.getByRole("combobox", { name: "Count as a conversion" })
    );
    await userEvent.click(
      screen.getByRole("option", { name: "A built-in event" })
    );
    await userEvent.click(
      screen.getByRole("combobox", { name: "Goal built-in event" })
    );
    await userEvent.click(screen.getByRole("option", { name: "App opened" }));
    await go("Save draft");
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    expect(api.create.mock.calls[0]![1].conversion).toEqual({
      system: "app_open",
      window_hours: 72,
    });
  });

  it("clearing the event clears the goal", async () => {
    open({
      initial: inAppCampaign({
        conversion: { event: "checkout", window_hours: 24 },
      }),
    });
    await go("Experiment");
    // The mocked picker answers with no value when it is clicked with one chosen.
    await go("Goal event");
    await go("Save draft");
    await waitFor(() => expect(api.update).toHaveBeenCalled());
    expect(api.update.mock.calls[0]![2].conversion).toBeNull();
  });

  it("a control group is a share, with what it costs under it", async () => {
    open();
    await fillMessage();
    await go("Experiment");
    const control = screen.getByRole("combobox", { name: "Control group" });
    expect(control).toHaveTextContent("No one held back");
    await userEvent.click(control);
    await userEvent.click(
      screen.getByRole("option", { name: "10% held back" })
    );
    expect(
      screen.getByText(
        "10% of the audience is held back as the control group. They won't see this message, so you can compare them with the people who did."
      )
    ).toBeInTheDocument();
    await go("Save draft");
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    expect(api.create.mock.calls[0]![1].control_group).toBe(10);
  });

  it("variants are added in the message step as copies of the active one, edited on their pill, and removed", async () => {
    open();
    await fillMessage();
    const bar = () => screen.getByRole("radiogroup", { name: "Variant" });
    expect(within(bar()).getByRole("radio", { name: "A" })).toHaveTextContent(
      "AHello"
    );
    expect(screen.queryByText("A 50% · B 50%")).toBeNull();
    await go("Add variant");
    expect(within(bar()).getByRole("radio", { name: "B" })).toBeChecked();
    expect(screen.getByLabelText("Title")).toHaveValue("Hello");
    expect(screen.getByText("A 50% · B 50%")).toBeInTheDocument();
    expect(
      screen.getByText("Variants share the pictures of A.")
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Choose portrait image")).toBeNull();
    // The shared choice is A's: the other option explains why it can't be picked here.
    expect(screen.getByRole("radio", { name: /Tap a button/ })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
    await userEvent.click(
      screen.getByRole("radio", { name: /Answer a question/ })
    );
    expect(await screen.findByText("Set on variant A")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Tap a button/ })).toBeChecked();
    await userEvent.click(
      screen.getByRole("button", { name: "Go to variant A" })
    );
    expect(within(bar()).getByRole("radio", { name: "A" })).toBeChecked();
    expect(
      screen.getByRole("radio", { name: /Tap a button/ })
    ).not.toHaveAttribute("aria-disabled");
    await userEvent.click(within(bar()).getByRole("radio", { name: "B" }));
    await userEvent.clear(screen.getByLabelText("Title"));
    await userEvent.type(screen.getByLabelText("Title"), "Hi there");
    expect(screen.getByTestId("in-app-preview-card")).toHaveTextContent(
      "Hi there"
    );
    expect(within(bar()).getByRole("radio", { name: "B" })).toHaveTextContent(
      "BHi there"
    );
    expect(within(bar()).getByRole("radio", { name: "A" })).toHaveTextContent(
      "AHello"
    );
    // C copies B, the active one.
    await go("Add variant");
    expect(within(bar()).getByRole("radio", { name: "C" })).toBeChecked();
    expect(screen.getByLabelText("Title")).toHaveValue("Hi there");
    expect(screen.queryByRole("button", { name: "Add variant" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Remove variant B" })
    ).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "Remove variant C" })
    );
    expect(within(bar()).getByRole("radio", { name: "A" })).toBeChecked();
    expect(screen.getByLabelText("Title")).toHaveValue("Hello");
    expect(screen.getByTestId("in-app-preview-card")).toHaveTextContent(
      "Hello"
    );
    expect(screen.getByLabelText("Choose portrait image")).toBeInTheDocument();
    await go("Save draft");
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    const input = api.create.mock.calls[0]![1];
    expect(input.content?.title).toBe("Hello");
    expect(input.variants).toEqual([
      { id: "b", content: expect.objectContaining({ title: "Hi there" }) },
    ]);
  });

  it("each variant's button and tap data show and edit that variant's own", async () => {
    open({
      preset: {
        ...draftFromCampaign(inAppCampaign()),
        buttons: [
          {
            id: "button_1",
            text: "Shop",
            action: { type: "key_value", payload: { a: "1" } },
          },
        ],
        tapAction: { type: "key_value", payload: { t: "a" } },
      },
    });
    await go("Add variant");
    const button = () => screen.getByLabelText("Button 1 data");
    const tap = () => screen.getByLabelText("Tap data");
    await userEvent.clear(button());
    await userEvent.type(button(), "b=2");
    await userEvent.clear(tap());
    await userEvent.type(tap(), "t=b");
    await userEvent.click(screen.getByRole("radio", { name: "A" }));
    expect(button()).toHaveValue("a=1");
    expect(tap()).toHaveValue("t=a");
    await userEvent.type(button(), "\nc=3");
    await go("Save draft");
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    const input = api.create.mock.calls[0]![1];
    expect(input.content?.buttons?.[0]?.action.payload).toEqual({
      a: "1",
      c: "3",
    });
    expect(input.content?.tap_action?.payload).toEqual({ t: "a" });
    const b = input.variants?.[0]?.content;
    expect(b?.buttons?.[0]?.action.payload).toEqual({ b: "2" });
    expect(b?.tap_action?.payload).toEqual({ t: "b" });
  });

  it("a variant shares A's question: kind and choices locked, wording its own", async () => {
    open({ preset: quickQuestionDraft() });
    await go("Add variant");
    expect(screen.getByRole("radio", { name: "B" })).toBeChecked();
    expect(screen.getByRole("radio", { name: /^Stars/ })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
    await userEvent.click(screen.getByRole("radio", { name: /^Stars/ }));
    expect(
      await screen.findByText("Question set on variant A")
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^Choices/ })).toBeChecked();
    expect(screen.queryByRole("button", { name: "Add choice" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Remove choice 1" })
    ).toBeDisabled();
    expect(screen.getByRole("radio", { name: /Tap a button/ })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
    await userEvent.clear(screen.getByLabelText("Choice 1"));
    await userEvent.type(screen.getByLabelText("Choice 1"), "Suche");
    await userEvent.click(screen.getByRole("radio", { name: "A" }));
    expect(screen.getByLabelText("Choice 1")).toHaveValue("Option 1");
    expect(
      screen.getByRole("button", { name: "Add choice" })
    ).toBeInTheDocument();
  });

  it("a variant with a problem is named with the message, and its pill is selected", async () => {
    open();
    await fillMessage();
    await go("Add variant");
    await userEvent.clear(screen.getByLabelText("Title"));
    await go("Check and launch");
    expect(
      screen.getByText(
        "Variant B: The message has no text yet. Add a title or a message."
      )
    ).toBeInTheDocument();
    await go("Launch");
    expect(
      screen.getByRole("heading", { name: "Message" })
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "B" })).toBeChecked();
  });

  it("the experiment step keeps the goal and the control group only", async () => {
    open();
    await fillMessage();
    await go("Experiment");
    expect(
      screen.getByText(
        /if you add variants in the Message step, which version wins/
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add variant/ })).toBeNull();
    expect(
      screen.getByRole("combobox", { name: "Control group" })
    ).toBeInTheDocument();
    // The split follows the control group, project control off the top.
    expect(screen.getByText("A 100%")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("combobox", { name: "Control group" })
    );
    await userEvent.click(
      screen.getByRole("option", { name: "20% held back" })
    );
    expect(screen.getByText("Control group 20% · A 80%")).toBeInTheDocument();
  });

  it("the control group and the variants are locked after launch, the content is not", async () => {
    open({
      initial: inAppCampaign({
        ...live,
        control_group: 20,
        variants: [{ id: "b", content: { title: "Hi" } }],
      }),
    });
    expect(screen.queryByRole("button", { name: "Add variant" })).toBeNull();
    await userEvent.click(screen.getByRole("radio", { name: "B" }));
    expect(
      screen.queryByRole("button", { name: "Remove variant B" })
    ).toBeNull();
    expect(screen.getByLabelText("Title")).toHaveValue("Hi");
    expect(screen.getByLabelText("Title")).toBeEnabled();
    await go("Experiment");
    expect(
      screen.getByRole("combobox", { name: "Control group" })
    ).toBeDisabled();
    expect(screen.getByText(/fixed at launch/)).toBeInTheDocument();
  });

  it("the review sums the experiment up", async () => {
    open({
      initial: inAppCampaign({
        control_group: 5,
        conversion: { event: "checkout", window_hours: 24 },
        variants: [
          { id: "b", content: { title: "Hi" } },
          { id: "c", content: { title: "Hey" } },
        ],
      }),
    });
    await go("Check and launch");
    expect(screen.getByText("checkout within 1 day")).toBeInTheDocument();
    expect(screen.getByText("5% never see it")).toBeInTheDocument();
    expect(screen.getByText("3: A, B, C")).toBeInTheDocument();
  });
});

describe("small pieces", () => {
  it("previewText puts the fallback, or the field name, where the value goes", () => {
    expect(previewText('Hi {{ user.first_name | default: "there" }}!')).toBe(
      "Hi there!"
    );
    expect(previewText("Total {{ event.total }}")).toBe("Total [total]");
    expect(previewText("Plain")).toBe("Plain");
  });

  it("toPayload reads one pair per line and drops the rest", () => {
    expect(toPayload("screen=offers\ncode = A=B \nnothing\n=x\n")).toEqual({
      screen: "offers",
      code: "A=B",
    });
  });

  it("creates one draft when two uploads start on a new message", async () => {
    let created: (value: unknown) => void = () => {};
    api.create.mockImplementation(
      () => new Promise((done) => (created = done)) as never
    );
    api.media.mockResolvedValue(ok({ media: [] }) as never);
    api.uploadMedia.mockResolvedValue(
      ok({
        media: {
          id: "m1",
          url: "https://cdn.example/a.png",
          type: "image/png",
          bytes: 10,
        },
        lock_version: 3,
      }) as never
    );
    open();
    await userEvent.click(screen.getByRole("combobox", { name: "Template" }));
    await userEvent.click(screen.getByRole("option", { name: /Custom HTML/ }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Browse examples" })
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /^Product launch/ })
    );
    const png = () => new File(["x"], "a.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Upload a file"), {
      target: { files: [png()] },
    });
    fireEvent.change(screen.getByLabelText("Upload Hero image"), {
      target: { files: [png()] },
    });
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    created(saved({ lock_version: 2 }));
    await waitFor(() => expect(api.uploadMedia).toHaveBeenCalledTimes(2));
    expect(api.create).toHaveBeenCalledTimes(1);
    // The new draft's own version goes with the first upload, and the one it left with the second.
    expect(api.uploadMedia.mock.calls.map((c) => c[3])).toEqual([2, 3]);
    await go("Done");
    await go("Save draft");
    await waitFor(() => expect(api.update).toHaveBeenCalledTimes(1));
    expect(api.update.mock.calls[0]![2].content!.html).toContain(
      "https://cdn.example/a.png"
    );
  });

  describe("media", () => {
    const html =
      '<img data-grovs-edit="Hero" src="https://x.example/a.png" width="10" height="10">';
    const file = (id: string) => ({
      id,
      url: `https://cdn.example/${id}.png`,
      type: "image/png",
      bytes: 10,
      used: false,
    });
    const png = (name = "a.png") =>
      new File(["x"], name, { type: "image/png" });
    const openSaved = () =>
      open({
        initial: inAppCampaign({
          template: "html",
          content: { html, layout: "modal" },
          lock_version: 3,
        }),
      });

    it("files dropped together each send the version the last one left", async () => {
      api.media.mockResolvedValue(ok({ media: [] }) as never);
      api.uploadMedia
        .mockResolvedValueOnce(
          ok({ media: file("m1"), lock_version: 4 }) as never
        )
        .mockResolvedValueOnce(
          ok({ media: file("m2"), lock_version: 5 }) as never
        );
      openSaved();
      await userEvent.click(
        await screen.findByRole("button", { name: "Edit design" })
      );
      fireEvent.change(screen.getByLabelText("Upload a file"), {
        target: { files: [png("a.png"), png("b.png")] },
      });
      await screen.findByRole("listitem", { name: "m2.png" });
      expect(api.uploadMedia.mock.calls.map((c) => c[3])).toEqual([3, 4]);
      await go("Done");
      await go("Save draft");
      await waitFor(() => expect(api.update).toHaveBeenCalledTimes(1));
      expect(api.update.mock.calls[0]![2].lock_version).toBe(5);
    });

    it("refuses uploads and deletes while a save is on its way", async () => {
      api.media.mockResolvedValue(ok({ media: [file("m1")] }) as never);
      api.update.mockReturnValue(new Promise(() => undefined) as never);
      openSaved();
      await go("Save draft");
      await waitFor(() => expect(api.update).toHaveBeenCalled());
      await userEvent.click(
        await screen.findByRole("button", { name: "Edit design" })
      );
      const wait =
        "Wait for the save or upload on its way to finish, then try again.";
      await userEvent.click(
        await screen.findByRole("button", { name: "Delete m1.png" })
      );
      expect(await screen.findByText(wait)).toBeInTheDocument();
      expect(api.removeMedia).not.toHaveBeenCalled();
      fireEvent.change(screen.getByLabelText("Upload a file"), {
        target: { files: [png()] },
      });
      await waitFor(() => expect(screen.getAllByText(wait)).toHaveLength(1));
      expect(api.uploadMedia).not.toHaveBeenCalled();
    });

    it("queues a delete behind a running upload instead of refusing it", async () => {
      api.media.mockResolvedValue(ok({ media: [file("m1")] }) as never);
      let finish: () => void = () => {};
      api.uploadMedia.mockReturnValue(
        new Promise((done) => {
          finish = () => done(ok({ media: file("m2"), lock_version: 4 }));
        }) as never
      );
      api.removeMedia.mockResolvedValue(
        ok({ message: "Deleted", lock_version: 5 }) as never
      );
      openSaved();
      await userEvent.click(
        await screen.findByRole("button", { name: "Edit design" })
      );
      fireEvent.change(screen.getByLabelText("Upload a file"), {
        target: { files: [png()] },
      });
      await waitFor(() => expect(api.uploadMedia).toHaveBeenCalled());
      await userEvent.click(
        await screen.findByRole("button", { name: "Delete m1.png" })
      );
      expect(screen.queryByText(/Wait for the save or upload/)).toBeNull();
      expect(api.removeMedia).not.toHaveBeenCalled();
      finish();
      await waitFor(() => expect(api.removeMedia).toHaveBeenCalledTimes(1));
      expect(api.removeMedia.mock.calls[0]![3]).toBe(4);
    });

    it("checks the files the campaign already holds", async () => {
      api.media.mockResolvedValue(
        ok({
          media: Array.from({ length: 30 }, (_, i) => file(`m${i}`)),
        }) as never
      );
      openSaved();
      await userEvent.click(
        await screen.findByRole("button", { name: "Edit design" })
      );
      await screen.findByText(/^30 of 30 files/);
      fireEvent.change(screen.getByLabelText("Upload Hero"), {
        target: { files: [png()] },
      });
      expect(
        await screen.findByText(
          "A message holds at most 30 files. Delete an unused one first."
        )
      ).toBeInTheDocument();
      expect(api.uploadMedia).not.toHaveBeenCalled();
    });

    it("says why nothing was uploaded when the new message could not be saved", async () => {
      api.create.mockRejectedValue(new Error("down"));
      api.media.mockResolvedValue(ok({ media: [] }) as never);
      open();
      await userEvent.click(screen.getByRole("combobox", { name: "Template" }));
      await userEvent.click(
        screen.getByRole("option", { name: /Custom HTML/ })
      );
      await userEvent.click(
        await screen.findByRole("button", { name: "Start blank" })
      );
      fireEvent.change(screen.getByLabelText("Upload a file"), {
        target: { files: [png()] },
      });
      expect(
        await screen.findByText(/The message could not be saved/)
      ).toBeInTheDocument();
      expect(api.uploadMedia).not.toHaveBeenCalled();
    });
  });

  it("media changes send the saved version, and a save after them sends the one they returned", async () => {
    const file = {
      id: "m1",
      url: "https://cdn.example/a.png",
      type: "image/png",
      bytes: 10,
      used: false,
    };
    api.create.mockResolvedValue(saved({ lock_version: 3 }) as never);
    api.update.mockResolvedValue(saved({ lock_version: 6 }) as never);
    api.media.mockResolvedValue(ok({ media: [] }) as never);
    api.uploadMedia.mockImplementation(async () => {
      api.media.mockResolvedValue(ok({ media: [file] }) as never);
      return ok({ media: file, lock_version: 5 }) as never;
    });
    api.removeMedia.mockResolvedValue(
      ok({ message: "Deleted", lock_version: 7 }) as never
    );
    open();
    await userEvent.click(screen.getByRole("combobox", { name: "Template" }));
    await userEvent.click(screen.getByRole("option", { name: /Custom HTML/ }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Start blank" })
    );
    await go("Done");
    await go("Save draft");
    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));

    await go("Edit design");
    fireEvent.change(screen.getByLabelText("Upload a file"), {
      target: { files: [new File(["x"], "a.png", { type: "image/png" })] },
    });
    await waitFor(() => expect(api.uploadMedia).toHaveBeenCalledTimes(1));
    expect(api.uploadMedia.mock.calls[0]![3]).toBe(3);
    await screen.findByRole("button", { name: "Delete a.png" });
    await go("Done");
    await go("Save draft");
    await waitFor(() => expect(api.update).toHaveBeenCalledTimes(1));
    expect(api.update.mock.calls[0]![2].lock_version).toBe(5);

    await go("Edit design");
    await userEvent.click(screen.getByRole("button", { name: "Delete a.png" }));
    await waitFor(() => expect(api.removeMedia).toHaveBeenCalledTimes(1));
    expect(api.removeMedia.mock.calls[0]![3]).toBe(6);
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Delete a.png" })).toBeNull()
    );
    await go("Done");
    await go("Save draft");
    await waitFor(() => expect(api.update).toHaveBeenCalledTimes(2));
    expect(api.update.mock.calls[1]![2].lock_version).toBe(7);
  });

  describe("a quick-edit upload that ends late", () => {
    const page = (word: string) =>
      `<h1 data-grovs-edit="Headline">${word}</h1><img data-grovs-edit="Hero" src="https://x.example/${word}.png" width="10" height="10">`;
    let finish: () => void = () => {};
    beforeEach(() => {
      api.media.mockResolvedValue(ok({ media: [] }) as never);
      api.uploadMedia.mockImplementation(
        () =>
          new Promise((done) => {
            finish = () =>
              done(
                ok({
                  media: {
                    id: "m1",
                    url: "https://cdn.example/new.png",
                    type: "image/png",
                    bytes: 10,
                  },
                  lock_version: 1,
                }) as never
              );
          })
      );
    });
    const startUpload = async () => {
      await userEvent.click(
        await screen.findByRole("button", { name: "Edit design" })
      );
      fireEvent.change(screen.getByLabelText("Upload Hero"), {
        target: { files: [new File(["x"], "a.png", { type: "image/png" })] },
      });
      await waitFor(() => expect(api.uploadMedia).toHaveBeenCalled());
    };
    const sent = async () => {
      await go("Save draft");
      await waitFor(() => expect(api.update).toHaveBeenCalled());
      return api.update.mock.calls.at(-1)![2];
    };

    it("lands on the variant it started on, not the one shown now", async () => {
      open({
        initial: inAppCampaign({
          template: "html",
          content: { html: page("A"), layout: "modal" },
          variants: [{ id: "b", content: { html: page("B") } }],
        }),
      });
      await startUpload();
      await userEvent.type(screen.getByLabelText("Headline"), "!");
      await go("Done");
      await userEvent.click(screen.getByRole("radio", { name: "B" }));
      finish();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Save draft" })).toBeEnabled()
      );
      const input = await sent();
      expect(input.content!.html).toContain("A!</h1>");
      expect(input.content!.html).toContain("https://cdn.example/new.png");
      expect(input.variants![0]!.content.html).toBe(page("B"));
    });

    it("a variant cannot be removed while an upload runs", async () => {
      open({
        initial: inAppCampaign({
          template: "html",
          content: { html: page("A"), layout: "modal" },
          variants: [{ id: "b", content: { html: page("B") } }],
        }),
      });
      await startUpload();
      await go("Done");
      await userEvent.click(screen.getByRole("radio", { name: "B" }));
      expect(
        screen.getByRole("button", { name: "Remove variant B" })
      ).toBeDisabled();
      finish();
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Remove variant B" })
        ).toBeEnabled()
      );
    });

    it("keeps the edits made since, after the message step was left", async () => {
      open({
        initial: inAppCampaign({
          template: "html",
          content: { html: page("A"), layout: "modal" },
        }),
      });
      await startUpload();
      await userEvent.type(screen.getByLabelText("Headline"), "!");
      await go("Done");
      await go("Trigger");
      finish();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Save draft" })).toBeEnabled()
      );
      const html = (await sent()).content!.html!;
      expect(html).toContain("A!</h1>");
      expect(html).toContain("https://cdn.example/new.png");
    });
  });

  it("saves a custom HTML message with its layout", async () => {
    open();
    await userEvent.click(screen.getByRole("combobox", { name: "Template" }));
    await userEvent.click(screen.getByRole("option", { name: /Custom HTML/ }));
    expect(
      screen.getByText(
        "Needs an app version with the new SDK; older versions skip this message."
      )
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Title")).toBeNull();
    await userEvent.click(
      await screen.findByRole("button", { name: "Start blank" })
    );
    await userEvent.click(screen.getByRole("combobox", { name: "Layout" }));
    await userEvent.click(screen.getByRole("option", { name: "Full screen" }));
    await go("Done");
    await go("Save draft");
    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
    const input = api.create.mock.calls[0]![1];
    expect(input.template).toBe("html");
    expect(input.content).toMatchObject({
      html: GALLERY.find((e) => e.id === "blank")!.html,
      layout: "full",
      buttons: [],
      title: null,
    });
    await go("Check and launch");
    expect(screen.getByText("Full screen")).toBeInTheDocument();
    expect(screen.queryByText(/Stays until/)).toBeNull();
  });

  it("summarises the HTML once it is started", async () => {
    open();
    await userEvent.click(screen.getByRole("combobox", { name: "Template" }));
    await userEvent.click(screen.getByRole("option", { name: /Custom HTML/ }));
    expect(
      await screen.findByText("Start from an example")
    ).toBeInTheDocument();
    await userEvent.click(
      await screen.findByRole("button", { name: "Start blank" })
    );
    // The design window's preview replaces the side one while it is open.
    expect(screen.getAllByTitle("Message preview")).toHaveLength(1);
    await go("Done");
    expect(screen.getAllByTitle("Message preview")).toHaveLength(1);
    expect(screen.getByText("No problems")).toBeInTheDocument();
    expect(screen.getByText(/ KB of 64 KB/)).toBeInTheDocument();
  });
});
