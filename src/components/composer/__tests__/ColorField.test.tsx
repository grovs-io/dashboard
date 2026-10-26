import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ColorField from "../ColorField";

const openAndType = async (text: string) => {
  await userEvent.click(screen.getByRole("button", { name: /^Background/ }));
  const input = await screen.findByLabelText("Background code");
  await userEvent.type(input, text);
  return input;
};

describe("ColorField", () => {
  it("accepts an 8-digit hex colour by default (in-app allows alpha)", async () => {
    const onChange = vi.fn();
    render(
      <ColorField
        label="Background"
        value={undefined}
        fallback="#FFFFFF"
        onChange={onChange}
      />
    );
    const input = await openAndType("#11223344");
    expect(input).toHaveAttribute("aria-invalid", "false");
    expect(onChange).toHaveBeenLastCalledWith("#11223344");
  });

  it("rejects an 8-digit hex colour when scoped to smart banners (hexOnly)", async () => {
    const onChange = vi.fn();
    render(
      <ColorField
        label="Background"
        value={undefined}
        fallback="#FFFFFF"
        onChange={onChange}
        hexOnly
      />
    );
    const input = await openAndType("#11223344");
    expect(input).toHaveAttribute("maxLength", "7");
    // The 7th character (closing the 6-digit value) is the last one accepted.
    expect(onChange).toHaveBeenLastCalledWith("#112233");
    expect(onChange).not.toHaveBeenCalledWith("#11223344");
  });

  it("accepts a 6-digit hex colour when hexOnly", async () => {
    const onChange = vi.fn();
    render(
      <ColorField
        label="Background"
        value={undefined}
        fallback="#FFFFFF"
        onChange={onChange}
        hexOnly
      />
    );
    const input = await openAndType("#112233");
    expect(input).toHaveAttribute("aria-invalid", "false");
    expect(onChange).toHaveBeenLastCalledWith("#112233");
  });
});
