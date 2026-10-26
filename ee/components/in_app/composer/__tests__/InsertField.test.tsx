import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { polyfillDom } from "@ee/components/push/composer/__tests__/helpers";
import InsertField from "../InsertField";

const suggestions = {
  loading: false,
  userAttributes: ["plan"],
  eventProperties: ["sku"],
};

describe("InsertField", () => {
  it("says the values are user attributes the app sets, and groups them by source", async () => {
    polyfillDom();
    render(
      <InsertField
        target="title"
        suggestions={suggestions}
        withEvent
        onInsert={vi.fn()}
      />
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Insert a value into the title" })
    );
    expect(
      screen.getByText(
        /saves on each person with the Grovs SDK \(userAttributes\)/
      )
    ).toBeInTheDocument();
    expect(screen.getByText("User attributes")).toBeInTheDocument();
    expect(screen.getByText("Event properties")).toBeInTheDocument();
    expect(screen.getByLabelText(/Fallback text/)).toBeInTheDocument();
    expect(screen.getByText(/becomes “Hi there”/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("option", { name: "plan" }));
    expect(
      screen.getByText(/Shown to people who have no plan\./)
    ).toBeInTheDocument();
  });

  it("explains where names come from when none are recorded", async () => {
    polyfillDom();
    render(
      <InsertField
        target="title"
        suggestions={{
          loading: false,
          userAttributes: [],
          eventProperties: [],
        }}
        withEvent={false}
        onInsert={vi.fn()}
      />
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Insert a value into the title" })
    );
    expect(
      screen.getByText(/No user attributes recorded yet/)
    ).toBeInTheDocument();
  });
});
