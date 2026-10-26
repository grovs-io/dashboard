import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { emptyJourney } from "@ee/lib/journeys";
import {
  polyfillDom,
  wrap,
} from "@ee/components/push/composer/__tests__/helpers";
import { GoalsSection } from "../sections";

vi.mock("@ee/components/segments/builder/ValuePicker", () => ({
  default: ({ ariaLabel }: { ariaLabel: string }) => <div>{ariaLabel}</div>,
}));

beforeEach(() => {
  polyfillDom();
});

describe("GoalsSection", () => {
  it("keeps a purchase goal with no products chosen yet, so its products can be picked", () => {
    wrap(
      <GoalsSection
        projectId="p1"
        draft={{
          ...emptyJourney(),
          goals: [{ purchase: true, products: [], window_hours: 168 }],
        }}
        locked={false}
        set={vi.fn()}
      />
    );
    expect(
      screen.getByRole("combobox", { name: "Which products" })
    ).toHaveTextContent("Only these products");
    expect(screen.getByText("Goal products")).toBeInTheDocument();
  });
});
