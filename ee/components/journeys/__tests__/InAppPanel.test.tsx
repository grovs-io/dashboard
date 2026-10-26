import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import {
  polyfillDom,
  wrap,
} from "@ee/components/push/composer/__tests__/helpers";
import InAppPanel from "../panels/InAppPanel";
import type { InAppJourneyStep } from "@ee/types/journey";

vi.mock("@ee/hooks/queries/useInAppSuggestions", () => ({
  useInAppSuggestions: () => ({
    loading: false,
    userAttributes: ["first_name"],
    eventProperties: [],
  }),
}));

const step: InAppJourneyStep = {
  id: "s1",
  type: "in_app",
  template: "interstitial",
  content: { title: "Hello" },
  triggers: [{ type: "app_open" }],
  caps: {},
  valid_days: 7,
  next: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  polyfillDom();
});

describe("InAppPanel", () => {
  it("offers custom HTML and keeps its html and layout on the step", async () => {
    const onChange = vi.fn();
    wrap(
      <InAppPanel
        projectId="p1"
        step={step}
        locked={false}
        onChange={onChange}
        uploadImage={vi.fn()}
      />
    );
    await userEvent.click(screen.getByRole("combobox", { name: "Template" }));
    await userEvent.click(screen.getByRole("option", { name: /Custom HTML/ }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Start blank" })
    );
    const last = onChange.mock.calls.at(-1)![0] as InAppJourneyStep;
    expect(last.template).toBe("html");
    expect(last.content.layout).toBe("modal");
    expect(last.content.html).toContain("<!doctype html>");
  });

  it("sets the orientation on the step and shows the one it has", async () => {
    const onChange = vi.fn();
    wrap(
      <InAppPanel
        projectId="p1"
        step={{
          ...step,
          content: { ...step.content, orientation: "landscape" },
        }}
        locked={false}
        onChange={onChange}
        uploadImage={vi.fn()}
      />
    );
    const choice = screen.getByRole("combobox", { name: "Orientation" });
    expect(choice).toHaveTextContent("Landscape only");
    await userEvent.click(choice);
    await userEvent.click(
      screen.getByRole("option", { name: "Portrait only" })
    );
    const last = onChange.mock.calls.at(-1)![0] as InAppJourneyStep;
    expect(last.content.orientation).toBe("portrait");
  });

  it("opens the same design editor, with the step's media", async () => {
    wrap(
      <InAppPanel
        projectId="p1"
        step={{
          ...step,
          template: "html",
          content: { html: "<p>Hi</p>", layout: "modal" },
        }}
        locked={false}
        onChange={vi.fn()}
        uploadImage={vi.fn()}
      />
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Edit design" })
    );
    const dialog = screen.getByRole("dialog", { name: "Design" });
    expect(within(dialog).getByLabelText("Upload a file")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("tab", { name: "Code" })
    ).toBeInTheDocument();
  });

  it("keeps this panel's uploads listed after the design window closes", async () => {
    const uploadImage = vi.fn(async () => "https://cdn.example/hero.png");
    wrap(
      <InAppPanel
        projectId="p1"
        step={{
          ...step,
          template: "html",
          content: { html: "<p>Hi</p>", layout: "modal" },
        }}
        locked={false}
        onChange={vi.fn()}
        uploadImage={uploadImage}
      />
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Edit design" })
    );
    await userEvent.upload(
      screen.getByLabelText("Upload a file"),
      new File(["x"], "hero.png", { type: "image/png" })
    );
    await screen.findByRole("listitem", { name: "hero.png" });
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    await userEvent.click(screen.getByRole("button", { name: "Edit design" }));
    expect(
      screen.getByRole("listitem", { name: "hero.png" })
    ).toBeInTheDocument();
  });

  it("lists the files the step's HTML uses after it is reopened", async () => {
    const url =
      "https://cdn.example/rails/active_storage/blobs/redirect/abc--1/hero%20shot.png";
    wrap(
      <InAppPanel
        projectId="p1"
        step={{
          ...step,
          template: "html",
          content: {
            html: `<img src="${url}" width="1" height="1"><img src="${url}">`,
            layout: "modal",
          },
        }}
        locked={false}
        onChange={vi.fn()}
        uploadImage={vi.fn(async () => url)}
      />
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Edit design" })
    );
    expect(
      screen.getAllByRole("listitem", { name: "hero shot.png" })
    ).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: "Delete hero shot.png" })
    ).toBeNull();
    // Uploading it again lists it once.
    await userEvent.upload(
      screen.getByLabelText("Upload a file"),
      new File(["x"], "hero shot.png", { type: "image/png" })
    );
    await waitFor(() =>
      expect(
        screen.getAllByRole("listitem", { name: "hero shot.png" })
      ).toHaveLength(1)
    );
  });

  describe("a quick-edit upload that ends late", () => {
    const html =
      '<h1 data-grovs-edit="Headline">Hi</h1><img data-grovs-edit="Hero" src="https://x.example/old.png" width="10" height="10">';
    const start = async (onChange: (s: InAppJourneyStep) => void) => {
      let finish: (url: string) => void = () => {};
      const uploadImage = vi.fn(
        () => new Promise<string>((done) => (finish = done))
      );
      const panel = (valid_days: number) => (
        <QueryClientProvider client={client}>
          <InAppPanel
            projectId="p1"
            step={{
              ...step,
              template: "html",
              content: { html, layout: "modal" },
              valid_days,
            }}
            locked={false}
            onChange={onChange}
            uploadImage={uploadImage}
          />
        </QueryClientProvider>
      );
      const client = new QueryClient();
      const view = render(panel(7));
      await userEvent.click(
        await screen.findByRole("button", { name: "Edit design" })
      );
      fireEvent.change(screen.getByLabelText("Upload Hero"), {
        target: { files: [new File(["x"], "a.png", { type: "image/png" })] },
      });
      expect(uploadImage).toHaveBeenCalled();
      return {
        view,
        rerender: (days: number) => view.rerender(panel(days)),
        finish: (url: string) => finish(url),
      };
    };

    it("keeps the edits made since", async () => {
      const onChange = vi.fn();
      const { finish } = await start(onChange);
      await userEvent.type(screen.getByLabelText("Headline"), "!");
      await act(async () => finish("https://cdn.example/new.png"));
      const last = onChange.mock.calls.at(-1)![0] as InAppJourneyStep;
      expect(last.content.html).toContain("Hi!</h1>");
      expect(last.content.html).toContain("https://cdn.example/new.png");
    });

    it("keeps step settings changed since", async () => {
      const onChange = vi.fn();
      const { rerender, finish } = await start(onChange);
      rerender(30);
      await act(async () => finish("https://cdn.example/new.png"));
      const last = onChange.mock.calls.at(-1)![0] as InAppJourneyStep;
      expect(last.valid_days).toBe(30);
      expect(last.content.html).toContain("https://cdn.example/new.png");
    });

    it("leaves the step alone once the panel is gone", async () => {
      const onChange = vi.fn();
      const { view, finish } = await start(onChange);
      view.unmount();
      onChange.mockClear();
      await act(async () => finish("https://cdn.example/new.png"));
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
