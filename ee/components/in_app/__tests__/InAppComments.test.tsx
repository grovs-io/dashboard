import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { format } from "date-fns";
import type { ReactNode } from "react";
import { inAppApi } from "@ee/api/in_app/inAppService";
import {
  ok,
  polyfillDom,
  wrap,
} from "@ee/components/push/composer/__tests__/helpers";
import { choiceAnswers, starsAnswers } from "@ee/lib/__tests__/inAppFixtures";
import { useInAppCommentsQuery } from "@ee/hooks/queries/useInAppQueries";
import type {
  InAppAnswers,
  InAppComment,
  InAppCommentsPage,
} from "@ee/types/inApp";
import InAppComments from "../InAppComments";

vi.mock("@ee/api/in_app/inAppService", () => ({
  inAppApi: { comments: vi.fn() },
}));

const api = vi.mocked(inAppApi.comments);
const period = { from: "2026-09-01", to: "2026-09-29" };

const comment = (n: number, value = "2"): InAppComment => ({
  value,
  comment: `Comment ${n}`,
  at: "2026-09-20T10:03:00Z",
  platform: "ios",
});
const page = (
  from: number,
  count: number,
  next_before: string | null = null
): InAppCommentsPage => ({
  comments: Array.from({ length: count }, (_, i) => comment(from + i)),
  next_before,
});
const answer = (pages: InAppCommentsPage) => ok(pages) as never;
// How many comments each number of stars has, from one star to five.
const counted = (...comments: number[]): InAppAnswers => ({
  ...starsAnswers,
  values: starsAnswers.values.map((v, i) => ({
    ...v,
    comments: comments[i] ?? 0,
  })),
});

let seen: (() => unknown) | null;
let observers: { disconnect: ReturnType<typeof vi.fn> }[];
// The end of the list scrolls into view.
const reachEnd = () =>
  act(() => {
    seen?.();
  });

const show = (answers: InAppAnswers = counted(0, 30, 0, 0, 5), over = {}) =>
  wrap(
    <InAppComments
      projectId="p1"
      campaignId="ask-1"
      period={period}
      answers={answers}
      {...over}
    />
  );

const panel = () => screen.getByRole("region", { name: /^Comments/ });
const comments = () =>
  [...panel().querySelectorAll("li")].filter(
    (li) => !li.hasAttribute("aria-hidden")
  );
const waiting = () => panel().querySelectorAll('li[aria-hidden="true"]');
const filter = () => screen.getByRole("combobox", { name: "Comments for" });
const option = (name: RegExp) => screen.getByRole("option", { name });
const choose = async (name: RegExp) => {
  await userEvent.click(filter());
  await userEvent.click(option(name));
};
// Each option as its text and its count.
const options = () =>
  screen
    .getAllByRole("option")
    .map((el) => el.textContent?.replace(/([\d,]+)$/, " $1"));
const asked = (call: number) => api.mock.calls[call]![2];

beforeEach(() => {
  vi.clearAllMocks();
  polyfillDom();
  seen = null;
  observers = [];
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      disconnect = vi.fn();
      observe = vi.fn();
      constructor(callback: IntersectionObserverCallback) {
        // As in a browser, an observer that was disconnected sees nothing.
        seen = () =>
          this.disconnect.mock.calls.length === 0 &&
          callback(
            [{ isIntersecting: true } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver
          );
        observers.push(this);
      }
    }
  );
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-22T10:03:00Z"));
  api.mockResolvedValue(answer(page(1, 2)));
});
afterEach(() => vi.useRealTimers());

describe("the list of comments", () => {
  it("waits with four rows, then shows the first page", async () => {
    api.mockReturnValue(new Promise(() => undefined) as never);
    show();
    expect(screen.getByLabelText("Loading comments")).toHaveAttribute(
      "aria-busy",
      "true"
    );
    expect(waiting()).toHaveLength(4);
  });

  it("stars: a comment shows its stars, its text, the platform and when", async () => {
    api.mockResolvedValue(
      answer({
        comments: [
          {
            value: "5",
            comment: "Love the new search",
            at: "2026-09-21T08:30:00Z",
            platform: "android",
          },
          comment(1),
        ],
        next_before: null,
      })
    );
    show();
    await waitFor(() => expect(comments()).toHaveLength(2));
    const [first, second] = comments();
    expect(first).toHaveTextContent("Love the new search");
    const given = within(second!).getByRole("img", { name: "2 stars" });
    expect(given.querySelectorAll("svg")).toHaveLength(5);
    expect(given.querySelectorAll('svg[data-filled="true"]')).toHaveLength(2);
    expect(given.querySelector('svg[data-filled="true"]')).toHaveClass(
      "fill-amber-400"
    );
    expect(second).toHaveTextContent("iOS·2 days ago");
    expect(first).toHaveTextContent("Android·1 day ago");
    expect(within(second!).getByText("2 days ago")).toHaveAttribute(
      "title",
      format(new Date("2026-09-20T10:03:00Z"), "d MMM yyyy, HH:mm")
    );
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
    expect(screen.queryByText(/newest 100/)).toBeNull();
  });

  it("a long comment is shown whole", async () => {
    const long = "word ".repeat(120).trim();
    api.mockResolvedValue(
      answer({
        comments: [{ ...comment(1), comment: long }],
        next_before: null,
      })
    );
    show();
    expect((await screen.findByText(long)).className).not.toMatch(
      /truncate|line-clamp/
    );
  });

  it("choices: a comment shows the text of the option, or its id when it is gone", async () => {
    api.mockResolvedValue(
      answer({
        comments: [
          { ...comment(1, "offline"), platform: "web" },
          comment(2, "gone"),
        ],
        next_before: null,
      })
    );
    show(choiceAnswers);
    await waitFor(() => expect(comments()).toHaveLength(2));
    expect(within(comments()[0]!).getByText("Offline mode")).toHaveAttribute(
      "title",
      "Offline mode"
    );
    expect(comments()[0]).toHaveTextContent("Web");
    expect(within(comments()[1]!).getByText("gone")).toBeInTheDocument();
  });

  it("asks for the next page when its end comes into view, and says when there is no more", async () => {
    api
      .mockResolvedValueOnce(answer(page(1, 25, "c25")))
      .mockResolvedValueOnce(answer(page(26, 10)));
    show();
    await waitFor(() => expect(comments()).toHaveLength(25));
    expect(screen.queryByText("That is all of them.")).toBeNull();
    reachEnd();
    await waitFor(() => expect(comments()).toHaveLength(35));
    expect(api).toHaveBeenCalledTimes(2);
    expect(asked(0)).toEqual({
      ...period,
      values: undefined,
      before: undefined,
    });
    expect(asked(1)).toEqual({ ...period, values: undefined, before: "c25" });
    expect(screen.getByText("That is all of them.")).toBeInTheDocument();
    expect(waiting()).toHaveLength(0);
    // Nothing is left to watch for.
    const watching = observers.filter(
      (o) => o.disconnect.mock.calls.length === 0
    );
    expect(watching).toHaveLength(0);
    reachEnd();
    expect(api).toHaveBeenCalledTimes(2);
  });

  it("goes on, page after page, until the very last comment", async () => {
    api
      .mockResolvedValueOnce(answer(page(1, 25, "c25")))
      .mockResolvedValueOnce(answer(page(26, 25, "c50")))
      .mockResolvedValueOnce(answer(page(51, 7)));
    show();
    await waitFor(() => expect(comments()).toHaveLength(25));
    reachEnd();
    await waitFor(() => expect(comments()).toHaveLength(50));
    expect(screen.queryByText("That is all of them.")).toBeNull();
    reachEnd();
    await waitFor(() => expect(comments()).toHaveLength(57));
    expect(api.mock.calls.map((call) => call[2].before)).toEqual([
      undefined,
      "c25",
      "c50",
    ]);
    expect(screen.getByText("That is all of them.")).toBeInTheDocument();
  });

  it("one page alone does not say it is the end", async () => {
    show();
    await waitFor(() => expect(comments()).toHaveLength(2));
    expect(screen.queryByText("That is all of them.")).toBeNull();
    expect(observers).toHaveLength(0);
  });

  it("shows three rows while a page is on its way, and asks for it once", async () => {
    let finish: (value: unknown) => void = () => undefined;
    api.mockResolvedValueOnce(answer(page(1, 25, "c25"))).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }) as never
    );
    show();
    await waitFor(() => expect(comments()).toHaveLength(25));
    reachEnd();
    await waitFor(() => expect(waiting()).toHaveLength(3));
    // Nothing watches the end of the list while a page is on its way.
    expect(
      observers.filter((o) => o.disconnect.mock.calls.length === 0)
    ).toHaveLength(0);
    reachEnd();
    expect(api).toHaveBeenCalledTimes(2);
    await act(async () => finish(ok(page(26, 1))));
    await waitFor(() => expect(comments()).toHaveLength(26));
    expect(waiting()).toHaveLength(0);
  });

  it("a page that fails is asked for again by hand, not by itself", async () => {
    api
      .mockResolvedValueOnce(answer(page(1, 25, "c25")))
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce(answer(page(26, 3)));
    show();
    await waitFor(() => expect(comments()).toHaveLength(25));
    reachEnd();
    expect(
      await screen.findByText("Could not load more comments.")
    ).toBeInTheDocument();
    expect(comments()).toHaveLength(25);
    reachEnd();
    expect(api).toHaveBeenCalledTimes(2);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(comments()).toHaveLength(28));
    expect(api).toHaveBeenCalledTimes(3);
    expect(asked(2)).toMatchObject({ before: "c25" });
    expect(screen.queryByText("Could not load more comments.")).toBeNull();
  });

  it("says when the first page could not be loaded", async () => {
    api
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce(answer(page(1, 2)));
    show();
    expect(
      await screen.findByText("Could not load the comments.")
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(comments()).toHaveLength(2));
  });

  it("says when there are none, with and without a filter", async () => {
    api.mockResolvedValue(answer(page(1, 0)));
    show();
    expect(await screen.findByText("No comments yet.")).toBeInTheDocument();
    await choose(/^1 to 3 stars/);
    expect(
      await screen.findByText("No comments for this answer.")
    ).toBeInTheDocument();
  });
});

describe("the filter of the comments", () => {
  it("stars: one list, grouped, with the true count on each line", async () => {
    show(counted(3, 1200, 0, 40, 167));
    expect(filter()).toHaveTextContent(/^All comments$/);
    expect(panel()).toHaveTextContent(/^Comments 1,410/);
    await userEvent.click(filter());
    expect(options()).toEqual([
      "All comments 1,410",
      "1 to 3 stars 1,203",
      "4 and 5 stars 207",
      "5 stars 167",
      "4 stars 40",
      "3 stars 0",
      "2 stars 1,200",
      "1 star 3",
    ]);
    expect(
      screen.getAllByRole("group").map((g) => g.textContent?.slice(0, 9))
    ).toEqual(["By rating", "By stars5"]);
    expect(
      within(option(/^4 stars/)).getByRole("img", { name: "4 stars" })
    ).toBeInTheDocument();
  });

  it("an answer nobody commented on is listed, and cannot be chosen", async () => {
    show(counted(0, 3, 0, 0, 0));
    await userEvent.click(filter());
    for (const name of [/^4 and 5 stars/, /^5 stars/, /^1 star/])
      expect(option(name)).toHaveAttribute("aria-disabled", "true");
    for (const name of [/^All comments/, /^1 to 3 stars/, /^2 stars/])
      expect(option(name)).not.toHaveAttribute("aria-disabled");
  });

  it("all comments can be chosen even when there are none", async () => {
    show(counted());
    expect(panel()).toHaveTextContent(/^Comments 0/);
    await userEvent.click(filter());
    expect(option(/^All comments/)).not.toHaveAttribute("aria-disabled");
    expect(option(/^1 to 3 stars/)).toHaveAttribute("aria-disabled", "true");
  });

  it("a group or one number of stars is asked of the server, from the first page", async () => {
    api.mockResolvedValueOnce(answer(page(1, 25, "c25")));
    show(counted(1, 30, 0, 4, 5));
    await waitFor(() => expect(comments()).toHaveLength(25));
    api.mockResolvedValue(answer(page(1, 3)));
    await choose(/^1 to 3 stars/);
    expect(filter()).toHaveTextContent(/^1 to 3 stars$/);
    expect(panel()).toHaveTextContent(/^Comments 31/);
    await waitFor(() => expect(comments()).toHaveLength(3));
    expect(asked(1)).toEqual({ ...period, values: "1,2,3", before: undefined });
    await choose(/^4 and 5 stars/);
    expect(panel()).toHaveTextContent(/^Comments 9/);
    await waitFor(() => expect(asked(2)?.values).toBe("4,5"));
    await choose(/^5 stars/);
    expect(filter()).toHaveTextContent(/^5 stars$/);
    expect(panel()).toHaveTextContent(/^Comments 5/);
    await waitFor(() => expect(asked(3)?.values).toBe("5"));
    expect(asked(3)?.before).toBeUndefined();
  });

  it("choices: one line for each choice, in their order", async () => {
    show({
      ...choiceAnswers,
      values: [
        { value: "search", label: "Search", count: 3, comments: 19 },
        { value: "offline", label: "Offline mode", count: 1, comments: 0 },
        { value: "friend", label: "A friend", count: 1, comments: 8 },
      ],
    });
    expect(panel()).toHaveTextContent(/^Comments 27/);
    await userEvent.click(filter());
    expect(options()).toEqual([
      "All comments 27",
      "Search 19",
      "Offline mode 0",
      "A friend 8",
    ]);
    expect(screen.getAllByRole("group")).toHaveLength(1);
    expect(screen.getByRole("group")).toHaveTextContent(/^By answer/);
    expect(option(/^Offline mode/)).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(option(/^A friend/));
    expect(filter()).toHaveTextContent(/^A friend$/);
    expect(panel()).toHaveTextContent(/^Comments 8/);
    await waitFor(() => expect(asked(1)?.values).toBe("friend"));
  });

  it("has no row of tabs", () => {
    show();
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
  });
});

describe("useInAppCommentsQuery", () => {
  const use = (params: { from: string; to: string; values?: string }) => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const useComments = (p: typeof params) =>
      useInAppCommentsQuery("p1", "ask-1", p);
    return renderHook(useComments, {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
      initialProps: params,
    });
  };

  it("follows the cursor of the page it has, until there is none", async () => {
    api
      .mockResolvedValueOnce(answer(page(1, 25, "c25")))
      .mockResolvedValueOnce(answer(page(26, 2)));
    const { result } = use(period);
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    await act(async () => {
      await result.current.fetchNextPage();
    });
    expect(asked(1)?.before).toBe("c25");
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(result.current.hasNextPage).toBe(false);
  });

  it("another filter or period starts from the first page", async () => {
    api
      .mockResolvedValueOnce(answer(page(1, 25, "c25")))
      .mockResolvedValueOnce(answer(page(26, 25, "c50")))
      .mockResolvedValue(answer(page(1, 25, "c25")));
    const { result, rerender } = use(period);
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    rerender({ ...period, values: "4,5" });
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));
    expect(api.mock.calls.at(-1)![2]).toEqual({
      ...period,
      values: "4,5",
      before: undefined,
    });
    rerender({ from: "2026-09-23", to: "2026-09-29", values: "4,5" });
    await waitFor(() =>
      expect(api.mock.calls.at(-1)![2]).toEqual({
        from: "2026-09-23",
        to: "2026-09-29",
        values: "4,5",
        before: undefined,
      })
    );
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));
  });
});
