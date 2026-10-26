import { describe, it, expect, beforeAll } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

vi.mock("@/hooks/queries/useAnalyticsEventsQueries", () => ({
  useAnalyticsEventFieldsQuery: vi.fn(() => ({ data: undefined })),
  useAnalyticsEventFieldValuesQuery: vi.fn(() => ({
    data: undefined,
    isLoading: false,
    isError: true,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    isFetchingNextPage: false,
  })),
}));

import QueryBar from "../QueryBar";

// Radix Popover (popper-positioned) uses ResizeObserver, which jsdom doesn't ship.
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (
      globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }
    ).ResizeObserver = ResizeObserverStub;
  }
});

describe("QueryBar", () => {
  it("reopens the picker when the still-focused input is clicked again", async () => {
    render(
      <QueryBar
        projectId="p1"
        queryFilters={[]}
        onAddFilter={() => {}}
        onRemoveFilter={() => {}}
        onClearAll={() => {}}
      />
    );

    const input = screen.getByPlaceholderText("Filter events...");
    await userEvent.click(input);
    expect(
      await screen.findByRole("option", { name: /^event type/i })
    ).toBeInTheDocument();

    // Outside pointerdown closes the popover without moving focus (e.g. a drag).
    fireEvent.pointerDown(document.body);
    await waitFor(() =>
      expect(screen.queryByRole("option", { name: /^event type/i })).toBeNull()
    );
    expect(input).toHaveFocus();

    await userEvent.click(input);
    expect(
      await screen.findByRole("option", { name: /^event type/i })
    ).toBeInTheDocument();
  });

  it("tells the user suggestions failed to load and lets them type a value anyway", async () => {
    render(
      <QueryBar
        projectId="p1"
        queryFilters={[]}
        onAddFilter={() => {}}
        onRemoveFilter={() => {}}
        onClearAll={() => {}}
      />
    );

    await userEvent.click(screen.getByPlaceholderText("Filter events..."));
    await userEvent.click(
      await screen.findByRole("option", { name: /^event type/i })
    );
    await userEvent.click(
      await screen.findByRole("option", { name: /^is\s*include$/i })
    );

    expect(
      await screen.findByText(
        "Couldn't load suggestions — type a value to filter anyway."
      )
    ).toBeInTheDocument();
  });

  it("offers only is / is not for Source and no free-typed value", async () => {
    render(
      <QueryBar
        projectId="p1"
        queryFilters={[]}
        onAddFilter={() => {}}
        onRemoveFilter={() => {}}
        onClearAll={() => {}}
      />
    );

    await userEvent.click(screen.getByPlaceholderText("Filter events..."));
    await userEvent.click(
      await screen.findByRole("option", { name: /^source\s*source$/i })
    );
    expect(
      await screen.findByRole("option", { name: /^is\s*include$/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /^is not\s*exclude$/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /contains/i })
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("option", { name: /^is\s*include$/i })
    );
    await userEvent.type(screen.getByPlaceholderText(/./), "google");
    expect(
      screen.queryByRole("option", { name: /^use "google"$/i })
    ).not.toBeInTheDocument();
  });
});
