import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { purchaseGoal, type Conversion } from "@ee/types/experiment";
import {
  polyfillDom,
  wrap,
} from "@ee/components/push/composer/__tests__/helpers";
import GoalField from "../GoalField";

vi.mock("@ee/components/segments/builder/ValuePicker", () => ({
  default: ({ ariaLabel }: { ariaLabel: string }) => <div>{ariaLabel}</div>,
}));

beforeEach(() => {
  polyfillDom();
});

function open(value: Conversion | null) {
  const onChange = vi.fn();
  wrap(<GoalField projectId="p1" value={value} onChange={onChange} />);
  return onChange;
}

describe("GoalField", () => {
  it('choosing "A purchase" emits a purchase goal with the default window', async () => {
    const onChange = open(null);
    await userEvent.click(
      screen.getByRole("combobox", { name: "Count as a conversion" })
    );
    await userEvent.click(screen.getByRole("option", { name: "A purchase" }));
    expect(onChange).toHaveBeenCalledWith({
      purchase: true,
      window_hours: 72,
    });
  });

  it("offers a 30-day window for a purchase goal", async () => {
    open(purchaseGoal([], 72));
    await userEvent.click(
      screen.getByRole("combobox", { name: "Conversion window" })
    );
    expect(
      screen.getByRole("option", { name: "within 30 days" })
    ).toBeInTheDocument();
  });

  it("does not offer a 30-day window for an event goal", async () => {
    open({ event: "checkout", window_hours: 72 });
    await userEvent.click(
      screen.getByRole("combobox", { name: "Conversion window" })
    );
    expect(
      screen.queryByRole("option", { name: "within 30 days" })
    ).not.toBeInTheDocument();
  });

  it("'Only these products' asks for products and blocks until one is chosen", async () => {
    const onChange = open(purchaseGoal([], 72));
    expect(screen.queryByText("Goal products")).toBeNull();
    await userEvent.click(
      screen.getByRole("combobox", { name: "Which products" })
    );
    await userEvent.click(
      screen.getByRole("option", { name: "Only these products" })
    );
    expect(onChange).toHaveBeenCalledWith({
      purchase: true,
      products: [],
      window_hours: 72,
    });
  });

  it("reads the product scope from the goal itself", () => {
    open({ purchase: true, products: [], window_hours: 72 });
    expect(
      screen.getByRole("combobox", { name: "Which products" })
    ).toHaveTextContent("Only these products");
    expect(screen.getByText("Goal products")).toBeInTheDocument();
    expect(
      screen.getByText("Choose at least one product, or count any product.")
    ).toBeInTheDocument();
  });

  it("opens on 'Any product' for an unrestricted purchase goal", () => {
    open(purchaseGoal([], 72));
    expect(
      screen.getByRole("combobox", { name: "Which products" })
    ).toHaveTextContent("Any product");
  });
});
