import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ExtraHostsInput from "../ExtraHostsInput";

function setup(
  overrides: Partial<React.ComponentProps<typeof ExtraHostsInput>> = {}
) {
  const onChange = vi.fn();
  const utils = render(
    <ExtraHostsInput value={[]} onChange={onChange} {...overrides} />
  );
  const input = screen.getByRole("textbox");
  return { ...utils, onChange, input };
}

describe("ExtraHostsInput", () => {
  it("adds a chip on Enter and lowercases it", () => {
    const { onChange, input } = setup();
    fireEvent.change(input, { target: { value: "XYZ-Alternate.App.Link" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(["xyz-alternate.app.link"]);
  });

  it("adds a chip on comma", () => {
    const { onChange, input } = setup();
    fireEvent.change(input, { target: { value: "a.app.link," } });
    expect(onChange).toHaveBeenCalledWith(["a.app.link"]);
  });

  it("commits the draft on blur", () => {
    const { onChange, input } = setup();
    fireEvent.change(input, { target: { value: "a.app.link" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(["a.app.link"]);
  });

  it("rejects invalid hostnames with an inline error", () => {
    const { onChange, input } = setup();
    fireEvent.change(input, { target: { value: "https://a.app.link" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/valid bare hostname/i)).toBeInTheDocument();
  });

  it("rejects duplicates and the main host", () => {
    const { onChange, input } = setup({
      value: ["a.app.link"],
      mainHost: "xyz.app.link",
    });
    fireEvent.change(input, { target: { value: "A.app.link" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText(/already added/i)).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "xyz.app.link" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText(/main domain/i)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("removes a chip via its remove button", () => {
    const { onChange } = setup({ value: ["a.app.link", "b.app.link"] });
    fireEvent.click(
      screen.getByRole("button", { name: /remove a\.app\.link/i })
    );
    expect(onChange).toHaveBeenCalledWith(["b.app.link"]);
  });

  it("removes the last chip on Backspace when the draft is empty", () => {
    const { onChange, input } = setup({ value: ["a.app.link", "b.app.link"] });
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(onChange).toHaveBeenCalledWith(["a.app.link"]);
  });

  it("renders a server error", () => {
    setup({ error: "Extra hosts contains invalid hostnames: nope" });
    expect(screen.getByText(/contains invalid hostnames/i)).toBeInTheDocument();
  });
});
