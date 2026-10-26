import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import QuickEdit from "../html/QuickEdit";
import { UploadRefused } from "../html/MediaPanel";

const suggestions = {
  userAttributes: ["first_name"],
  eventProperties: [],
  loading: false,
};

const HTML = `<!doctype html>
<html><head></head>
<body data-grovs-edit-color="--brand" style="--brand: #4F46E5">
<h1 data-grovs-edit="Headline">Hello</h1>
<img data-grovs-edit="Hero image" src="https://cdn.example/a.png" width="10" height="10" alt="">
<button data-grovs-edit="Main button" data-grovs-action="close">OK</button>
<button id="js" data-grovs-edit="Allow button">Allow</button>
</body></html>`;

function Harness({
  onUpload,
  spy,
}: {
  onUpload?: (file: File) => Promise<string>;
  spy: (html: string) => void;
}) {
  const [html, setHtml] = useState(HTML);
  return (
    <QuickEdit
      html={html}
      onChange={(next) => {
        spy(next);
        setHtml(next);
      }}
      setHtml={(update) =>
        setHtml((now) => {
          const next = update(now);
          spy(next);
          return next;
        })
      }
      suggestions={suggestions}
      withEvent={false}
      onUpload={onUpload}
    />
  );
}

const last = (spy: ReturnType<typeof vi.fn>) =>
  new DOMParser().parseFromString(
    spy.mock.calls.at(-1)![0] as string,
    "text/html"
  );

describe("QuickEdit", () => {
  it("edits text as it is typed", async () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    const headline = screen.getByLabelText("Headline");
    expect(headline).toHaveValue("Hello");
    await userEvent.type(headline, " you");
    expect(last(spy).querySelector("h1")!.textContent).toBe("Hello you");
    expect(screen.getByLabelText("Headline")).toHaveValue("Hello you");
  });

  it("offers a custom-JavaScript button as text only", () => {
    render(<Harness spy={vi.fn()} />);
    expect(screen.getByLabelText("Allow button")).toHaveValue("Allow");
    expect(screen.queryByLabelText("Allow button action")).toBeNull();
    expect(screen.getByLabelText("Main button action")).toBeInTheDocument();
  });

  it("changes a button's action and its details", async () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    await userEvent.click(
      screen.getByRole("combobox", { name: "Main button action" })
    );
    await userEvent.click(screen.getByRole("option", { name: "Open a link" }));
    const link = screen.getByLabelText("Main button link");
    fireEvent.change(link, { target: { value: "https://shop.example" } });
    const button = last(spy).querySelector("button")!;
    expect(button.getAttribute("data-grovs-action")).toBe("open");
    expect(button.getAttribute("data-grovs-url")).toBe("https://shop.example");
    fireEvent.change(screen.getByLabelText("Main button link"), {
      target: { value: "javascript:alert(1)" },
    });
    expect(
      screen.getByText("Use an https:// link or an app link such as myapp://.")
    ).toBeInTheDocument();
  });

  it("changes the brand colour", async () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Brand colour: #4F46E5" })
    );
    await userEvent.click(screen.getByRole("option", { name: "#10B981" }));
    expect(
      (last(spy).body as HTMLElement).style.getPropertyValue("--brand").trim()
    ).toBe("#10B981");
  });

  it("uploads a picture and uses its address", async () => {
    const spy = vi.fn();
    const onUpload = vi.fn().mockResolvedValue("https://cdn.example/b.png");
    render(<Harness spy={spy} onUpload={onUpload} />);
    const file = new File(["x"], "b.png", { type: "image/png" });
    await userEvent.upload(screen.getByLabelText("Upload Hero image"), file);
    expect(onUpload).toHaveBeenCalledWith(file);
    await waitFor(() =>
      expect(last(spy).querySelector("img")!.getAttribute("src")).toBe(
        "https://cdn.example/b.png"
      )
    );
  });

  it("says why an upload was refused", async () => {
    const onUpload = vi
      .fn()
      .mockRejectedValue(
        new UploadRefused("A message holds at most 30 files.")
      );
    render(<Harness spy={vi.fn()} onUpload={onUpload} />);
    await userEvent.upload(
      screen.getByLabelText("Upload Hero image"),
      new File(["x"], "b.png", { type: "image/png" })
    );
    expect(
      await screen.findByText("A message holds at most 30 files.")
    ).toBeInTheDocument();
  });

  it("refuses a file of the wrong kind before uploading", async () => {
    const onUpload = vi.fn();
    render(<Harness spy={vi.fn()} onUpload={onUpload} />);
    const file = new File(["x"], "a.mp4", { type: "video/mp4" });
    await userEvent.upload(screen.getByLabelText("Upload Hero image"), file, {
      applyAccept: false,
    });
    expect(onUpload).not.toHaveBeenCalled();
    expect(
      screen.getByText("Choose a PNG, JPEG or GIF image.")
    ).toBeInTheDocument();
  });

  it("explains how to mark parts when there are none", () => {
    render(
      <QuickEdit
        html="<!doctype html><p>Hi</p>"
        onChange={vi.fn()}
        setHtml={vi.fn()}
        suggestions={suggestions}
        withEvent={false}
      />
    );
    expect(screen.getByText(/data-grovs-edit="Headline"/)).toBeInTheDocument();
  });
});
