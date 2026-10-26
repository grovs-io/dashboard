import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { POST } from "@/lib/api";
import type { PushContentFormValues } from "@/schemas/push";
import { emptyContent } from "@ee/lib/pushComposer";
import MessageSection, { usePushContentForm } from "../MessageSection";
import { ok, polyfillDom, wrap } from "./helpers";

vi.mock("@/lib/api", () => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PATCH: vi.fn(),
  DELETE: vi.fn(),
}));
vi.mock("@/lib/config", () => ({ config: { apiPath: "/api/v1" } }));

const onFile = vi.fn();

function Harness({
  defaults = emptyContent(),
}: {
  defaults?: PushContentFormValues;
}) {
  const form = usePushContentForm(defaults);
  const [file, setFile] = useState<File | null>(null);
  return (
    <>
      <MessageSection
        projectId="p1"
        form={form}
        imageFile={file}
        onImageFileChange={(f) => {
          onFile(f);
          setFile(f);
        }}
        uploadedImage={null}
        onRemoveUploadedImage={vi.fn()}
      />
      <button type="button" onClick={() => void form.trigger()}>
        validate
      </button>
    </>
  );
}

const fileInput = () =>
  document.querySelector('input[type="file"]') as HTMLInputElement;

beforeEach(() => {
  vi.clearAllMocks();
  polyfillDom();
  vi.mocked(POST).mockResolvedValue(ok({ links: [] }));
});

describe("MessageSection", () => {
  it("shows schema errors for a blank title and body", async () => {
    wrap(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "validate" }));
    expect(
      await screen.findByText("Add a title: the bold first line people see.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Add the message: the text people see under the title.")
    ).toBeInTheDocument();
  });

  it("refuses a reserved grovs_ data key inline", async () => {
    wrap(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /Advanced/ }));
    await userEvent.click(screen.getByRole("button", { name: /Add field/ }));
    await userEvent.type(screen.getByLabelText("Data key 1"), "grovs_link");
    expect(
      screen.getByText(
        "Keys starting with grovs_ are reserved for Grovs. Pick another key."
      )
    ).toBeInTheDocument();
  });

  it("warns once the estimated APNs payload passes 4096 bytes", () => {
    const small = { ...emptyContent(), title: "Hi", body: "There" };
    const { unmount } = wrap(<Harness defaults={small} />);
    expect(screen.queryByText(/Apple allows/)).not.toBeInTheDocument();
    unmount();

    wrap(
      <Harness
        defaults={{
          ...small,
          body: "€".repeat(1000),
          data: [{ key: "blob", value: "x".repeat(1200) }],
        }}
      />
    );
    expect(screen.getByText(/Apple allows 4,096/)).toBeInTheDocument();
  });

  it("refuses an image file over 1 MB before it is staged", async () => {
    wrap(<Harness />);
    const big = new File([new Uint8Array(1024 * 1024 + 1)], "big.png", {
      type: "image/png",
    });
    await userEvent.upload(fileInput(), big);
    expect(
      await screen.findByText("This image is too big: it can be at most 1 MB.")
    ).toBeInTheDocument();
    expect(onFile).not.toHaveBeenCalledWith(big);
  });

  it("stages a small file and notes that a URL wins when both are set", async () => {
    wrap(<Harness />);
    const small = new File([new Uint8Array(10)], "ok.png", {
      type: "image/png",
    });
    await userEvent.upload(fileInput(), small);
    expect(onFile).toHaveBeenLastCalledWith(small);
    expect(
      screen.queryByText("The URL is used when both are set.")
    ).not.toBeInTheDocument();

    await userEvent.type(
      screen.getByLabelText("Or an image URL"),
      "https://cdn.test/a.png"
    );
    await waitFor(() =>
      expect(
        screen.getByText("The URL is used when both are set.")
      ).toBeInTheDocument()
    );
  });
});
