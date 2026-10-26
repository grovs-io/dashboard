import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { inAppApi } from "@ee/api/in_app/inAppService";
import {
  ok,
  polyfillDom,
  wrap,
} from "@ee/components/push/composer/__tests__/helpers";
import { choiceAnswers, starsAnswers } from "@ee/lib/__tests__/inAppFixtures";
import type { InAppAnswers as Answers } from "@ee/types/inApp";
import InAppAnswers, { AnswersSkeleton } from "../InAppAnswers";

vi.mock("@ee/api/in_app/inAppService", () => ({
  inAppApi: { comments: vi.fn() },
}));

const bars = () => screen.getByRole("region", { name: "What people answered" });
const row = (label: string) => within(bars()).getByText(label).closest("li")!;
const bar = (label: string) =>
  within(row(label)).getByTestId("in-app-answer-bar");
const show = (answers: Answers) =>
  wrap(
    <InAppAnswers
      projectId="p1"
      campaignId="ask-1"
      period={{ from: "2026-09-01", to: "2026-09-29" }}
      answers={answers}
    />
  );

beforeEach(() => {
  vi.clearAllMocks();
  polyfillDom();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe = vi.fn();
      disconnect = vi.fn();
    }
  );
  vi.mocked(inAppApi.comments).mockResolvedValue(
    ok({ comments: [], next_before: null }) as never
  );
});

describe("InAppAnswers", () => {
  it("stars: the average in words, and a bar for each number of stars", () => {
    show(starsAnswers);
    expect(bars()).toHaveTextContent("4.2 out of 5 on average");
    expect(screen.getAllByTestId("in-app-answer-bar")).toHaveLength(5);
    expect(row("1 star")).toHaveTextContent("1 star00%");
    expect(row("5 stars")).toHaveTextContent("5 stars350%");
    expect(bar("5 stars")).toHaveStyle({ width: "100%" });
    expect(bar("4 stars")).toHaveStyle({ width: "67%" });
    expect(bar("1 star")).toHaveStyle({ width: "0%" });
  });

  it("does not count the answers again: the results cards do", () => {
    show(starsAnswers);
    expect(screen.queryByText("Answers")).toBeNull();
    expect(screen.queryByText("Score")).toBeNull();
  });

  it("choices: no score, and bars by their text", () => {
    show(choiceAnswers);
    expect(bars()).not.toHaveTextContent("on average");
    expect(row("Search")).toHaveTextContent("Search375%");
    expect(row("Offline mode")).toHaveTextContent("Offline mode125%");
    expect(bar("Offline mode")).toHaveStyle({ width: "33%" });
  });

  it("choices: one removed after launch still counts, under its id, in muted text", () => {
    show({
      ...choiceAnswers,
      count: 6,
      values: [
        ...choiceAnswers.values,
        { value: "option_2", label: "option_2", count: 2, comments: 0 },
      ],
    });
    expect(row("option_2")).toHaveTextContent("option_2233%");
    const label = within(row("option_2")).getByText("option_2");
    expect(label).toHaveClass("text-muted-foreground");
    expect(label).toHaveAttribute("title", "This choice was removed");
    const kept = within(row("Search")).getByText("Search");
    expect(kept).not.toHaveClass("text-muted-foreground");
    expect(kept).not.toHaveAttribute("title");
    expect(row("Search")).toHaveTextContent("Search350%");
  });

  it("nothing answered yet: no score, empty bars", () => {
    show({
      ...starsAnswers,
      count: 0,
      score: null,
      values: starsAnswers.values.map((v) => ({ ...v, count: 0 })),
    });
    expect(bars()).not.toHaveTextContent("on average");
    expect(bar("5 stars")).toHaveStyle({ width: "0%" });
    expect(row("5 stars")).toHaveTextContent("00%");
  });

  it("sits beside the comments of the same period", async () => {
    show(starsAnswers);
    expect(
      await screen.findByRole("region", { name: /^Comments/ })
    ).toBeInTheDocument();
    expect(inAppApi.comments).toHaveBeenCalledWith(
      "p1",
      "ask-1",
      { from: "2026-09-01", to: "2026-09-29", before: undefined },
      expect.anything()
    );
  });
});

describe("AnswersSkeleton", () => {
  it("holds a bar for each answer and four comments", () => {
    wrap(<AnswersSkeleton rows={3} stars={false} />);
    expect(within(bars()).getAllByRole("listitem")).toHaveLength(3);
    expect(
      screen.getByRole("region", { name: "Comments" }).querySelectorAll("li")
    ).toHaveLength(4);
  });
});
