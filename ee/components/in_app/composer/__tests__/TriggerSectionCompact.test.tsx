import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { emptyDraft } from "@ee/lib/inAppComposer";
import type { InAppSuggestions } from "@ee/hooks/queries/useInAppSuggestions";
import {
  polyfillDom,
  wrap,
} from "@ee/components/push/composer/__tests__/helpers";
import TriggerSection from "../TriggerSection";

vi.mock("@ee/components/segments/builder/ValuePicker", () => ({
  default: ({ ariaLabel }: { ariaLabel: string }) => <div>{ariaLabel}</div>,
}));

beforeEach(() => {
  polyfillDom();
});

describe("TriggerSection compact", () => {
  it("picks the trigger from a dropdown instead of cards", async () => {
    const set = vi.fn();
    wrap(
      <TriggerSection
        projectId="p1"
        draft={emptyDraft()}
        set={set}
        suggestions={{} as InAppSuggestions}
        delay={false}
        compact
      />
    );
    expect(screen.queryByRole("radiogroup")).toBeNull();
    await userEvent.click(screen.getByRole("combobox", { name: "Trigger 1" }));
    await userEvent.click(
      screen.getByRole("option", { name: "An event is tracked" })
    );
    expect(set).toHaveBeenCalledWith({
      triggers: [{ type: "event", name: "" }],
    });
  });
});
