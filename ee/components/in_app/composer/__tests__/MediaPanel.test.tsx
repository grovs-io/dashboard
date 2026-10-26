import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { showErrorNotification } from "@/lib/Notifications";
import { ApiError } from "@/lib/ApiError";
import { inAppApi } from "@ee/api/in_app/inAppService";
import { ok, wrap } from "@ee/components/push/composer/__tests__/helpers";
import type { InAppMedia } from "@ee/types/inApp";
import {
  CampaignMedia,
  MediaInsert,
  MediaPanel,
  UploadRefused,
  WAIT,
} from "../html/MediaPanel";

vi.mock("@ee/api/in_app/inAppService", () => ({
  inAppApi: { media: vi.fn() },
}));

const api = vi.mocked(inAppApi);
const MB = 1024 * 1024;

const item = (over: Partial<InAppMedia> = {}): InAppMedia => ({
  id: "m1",
  url: "https://cdn.example/media/hero.png",
  type: "image/png",
  bytes: 200 * 1024,
  used: false,
  ...over,
});

const sized = (name: string, type: string, bytes: number) => {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: bytes });
  return file;
};

function open(over: Partial<Parameters<typeof CampaignMedia>[0]> = {}) {
  const props = {
    projectId: "p1",
    campaignId: "c1",
    htmls: ['<img src="https://cdn.example/media/hero.png">'],
    upload: vi.fn(async () => "https://cdn.example/media/new.png"),
    remove: vi.fn(async () => undefined),
    ...over,
  };
  wrap(<CampaignMedia {...props} />);
  return props;
}

vi.mock("@/lib/Notifications", () => ({ showErrorNotification: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  api.media.mockResolvedValue(
    ok({
      media: [
        item(),
        item({
          id: "m2",
          url: "https://cdn.example/media/intro.mp4",
          type: "video/mp4",
          bytes: 5 * MB,
        }),
      ],
    }) as never
  );
});

describe("CampaignMedia", () => {
  it("shows each file as a tile with its kind, size and whether it is used", async () => {
    open();
    const video = await screen.findByRole("listitem", { name: "intro.mp4" });
    expect(within(video).getByText("MP4")).toBeInTheDocument();
    expect(within(video).getByText("5.0 MB")).toBeInTheDocument();
    expect(within(video).getByText("Not used yet")).toBeInTheDocument();
    expect(video.querySelector("video")).toHaveAttribute(
      "src",
      "https://cdn.example/media/intro.mp4#t=0.1"
    );
    const image = screen.getByRole("listitem", { name: "hero.png" });
    expect(image.querySelector("img")).toHaveAttribute(
      "src",
      "https://cdn.example/media/hero.png"
    );
    expect(within(image).getByText("PNG")).toBeInTheDocument();
    expect(within(image).getByText("Used in this message")).toHaveClass(
      "text-valid-green"
    );
    // Insert needs an editor to insert into.
    expect(within(image).queryByRole("button", { name: /^Insert/ })).toBeNull();
    expect(
      screen.getByText("2 of 30 files, 5.2 MB of 100 MB")
    ).toBeInTheDocument();
  });

  it("uploads files dropped on the panel, one after another", async () => {
    let finish: () => void = () => {};
    const upload = vi.fn<(file: File) => Promise<string>>(
      () => new Promise((done) => (finish = () => done("u")))
    );
    open({ upload });
    const tile = await screen.findByRole("listitem", { name: "intro.mp4" });
    const panel = tile.closest("ul")!.parentElement!;
    const files = [
      sized("a.png", "image/png", 1000),
      sized("b.png", "image/png", 1000),
    ];
    const dataTransfer = { types: ["Files"], files };
    fireEvent.dragEnter(panel, { dataTransfer });
    expect(screen.getByText("Drop to upload")).toBeInTheDocument();
    fireEvent.drop(panel, { dataTransfer });
    expect(screen.queryByText("Drop to upload")).toBeNull();
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Uploading a.png…")).toBeInTheDocument();
    finish();
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(2));
    expect(upload.mock.calls.map(([file]) => file.name)).toEqual([
      "a.png",
      "b.png",
    ]);
  });

  it("queues files dropped while an upload is on its way, in order", async () => {
    const pending: (() => void)[] = [];
    const upload = vi.fn<(file: File) => Promise<string>>(
      () => new Promise((done) => pending.push(() => done("u")))
    );
    open({ upload });
    const tile = await screen.findByRole("listitem", { name: "intro.mp4" });
    const panel = tile.closest("ul")!.parentElement!;
    const drop = (...names: string[]) =>
      fireEvent.drop(panel, {
        dataTransfer: {
          types: ["Files"],
          files: names.map((n) => sized(n, "image/png", 1000)),
        },
      });
    drop("a.png", "b.png");
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
    drop("c.png");
    await userEvent.upload(
      screen.getByLabelText("Upload a file"),
      sized("d.png", "image/png", 1000)
    );
    for (let n = 2; n <= 4; n++) {
      pending.shift()!();
      await waitFor(() => expect(upload).toHaveBeenCalledTimes(n));
    }
    pending.shift()!();
    expect(upload.mock.calls.map(([file]) => file.name)).toEqual([
      "a.png",
      "b.png",
      "c.png",
      "d.png",
    ]);
    expect(screen.queryByText(WAIT)).toBeNull();
  });

  it("refuses a file over its kind's limit before sending it", async () => {
    const props = open();
    await screen.findByRole("listitem", { name: "intro.mp4" });
    await userEvent.upload(
      screen.getByLabelText("Upload a file"),
      sized("big.mp4", "video/mp4", 21 * MB)
    );
    expect(
      await screen.findByText("A video must be under 20 MB.")
    ).toBeInTheDocument();
    expect(props.upload).not.toHaveBeenCalled();
  });

  it("refuses the 31st file", async () => {
    api.media.mockResolvedValue(
      ok({
        media: Array.from({ length: 30 }, (_, i) =>
          item({ id: `m${i}`, url: `https://cdn.example/${i}.png` })
        ),
      }) as never
    );
    const props = open({ htmls: [] });
    await screen.findByText("30 of 30 files, 5.9 MB of 100 MB");
    await userEvent.upload(
      screen.getByLabelText("Upload a file"),
      sized("a.png", "image/png", 10)
    );
    expect(
      await screen.findByText(
        "A message holds at most 30 files. Delete an unused one first."
      )
    ).toBeInTheDocument();
    expect(props.upload).not.toHaveBeenCalled();
  });

  it("deletes an unused file", async () => {
    const props = open();
    const video = await screen.findByRole("listitem", { name: "intro.mp4" });
    await userEvent.click(
      within(video).getByRole("button", { name: "Delete intro.mp4" })
    );
    expect(props.remove).toHaveBeenCalledWith(
      expect.objectContaining({ id: "m2" })
    );
  });

  it("says why an upload or delete was refused", async () => {
    open({
      upload: vi.fn().mockRejectedValue(new UploadRefused(WAIT)),
      remove: vi.fn().mockRejectedValue(new UploadRefused("Not now.")),
    });
    const video = await screen.findByRole("listitem", { name: "intro.mp4" });
    await userEvent.upload(
      screen.getByLabelText("Upload a file"),
      sized("a.png", "image/png", 1000)
    );
    expect(await screen.findByText(WAIT)).toBeInTheDocument();
    await userEvent.click(
      within(video).getByRole("button", { name: "Delete intro.mp4" })
    );
    expect(await screen.findByText("Not now.")).toBeInTheDocument();
  });

  it("shows the server's reason when an upload or delete fails", async () => {
    const stale = new ApiError("Conflict", 409, undefined, {
      error: "Campaign changed while you were editing it; reload and retry",
    });
    open({
      upload: vi.fn().mockRejectedValue(stale),
      remove: vi.fn().mockRejectedValue(stale),
    });
    const video = await screen.findByRole("listitem", { name: "intro.mp4" });
    await userEvent.upload(
      screen.getByLabelText("Upload a file"),
      sized("a.png", "image/png", 1000)
    );
    expect(
      await screen.findByText(
        "Campaign changed while you were editing it; reload and retry"
      )
    ).toBeInTheDocument();
    await userEvent.click(
      within(video).getByRole("button", { name: "Delete intro.mp4" })
    );
    expect(
      await screen.findByText(
        "Campaign changed while you were editing it; reload and retry"
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole("listitem", { name: "intro.mp4" })
    ).toBeInTheDocument();
  });

  it("explains a file the saved message still uses", async () => {
    open({
      htmls: [],
      remove: vi
        .fn()
        .mockRejectedValue(
          new ApiError("Conflict", 409, undefined, { error: "in_use" })
        ),
    });
    const image = await screen.findByRole("listitem", { name: "hero.png" });
    await userEvent.click(
      within(image).getByRole("button", { name: "Delete hero.png" })
    );
    expect(
      await screen.findByText(
        "The last saved version still shows hero.png. Save the message, then delete it."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole("listitem", { name: "hero.png" })
    ).toBeInTheDocument();
  });

  it("explains why a file the HTML still shows cannot be deleted", async () => {
    const props = open({
      htmls: ["<p></p>", '<img src="https://cdn.example/media/hero.png">'],
    });
    const image = await screen.findByRole("listitem", { name: "hero.png" });
    await userEvent.click(
      within(image).getByRole("button", { name: "Delete hero.png" })
    );
    expect(showErrorNotification).toHaveBeenCalledWith(
      "hero.png can\u2019t be deleted",
      "It\u2019s still in the HTML. Take it out first."
    );
    expect(props.remove).not.toHaveBeenCalled();
  });
});

describe("MediaPanel", () => {
  it("inserts a file with an image's own size once it is known", async () => {
    const insert = vi.fn();
    wrap(
      <MediaInsert value={insert}>
        <MediaPanel
          items={[
            item(),
            item({
              id: "m2",
              url: "https://cdn.example/a.mp4",
              type: "video/mp4",
            }),
          ]}
          onUpload={vi.fn()}
        />
      </MediaInsert>
    );
    await userEvent.click(screen.getByRole("button", { name: "Insert a.mp4" }));
    expect(insert).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "m2" }),
      undefined
    );
    const img = screen
      .getByRole("listitem", { name: "hero.png" })
      .querySelector("img")!;
    Object.defineProperty(img, "naturalWidth", { value: 300 });
    Object.defineProperty(img, "naturalHeight", { value: 150 });
    fireEvent.load(img);
    await userEvent.click(
      screen.getByRole("button", { name: "Insert hero.png" })
    );
    expect(insert).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "m1" }),
      { width: 300, height: 150 }
    );
  });
});
