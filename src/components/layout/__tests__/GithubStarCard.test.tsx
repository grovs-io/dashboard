import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

const nav = { pathname: "/dashboard" };
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));

import GithubStarCard, {
  ASK_DELAY_MS,
  REPO_URL,
} from "@/components/layout/GithubStarCard";

const KEY = "grovs:github_star";
const NOW = new Date(2026, 9, 21, 12);
const DAY = 24 * 60 * 60 * 1000;
const seed = (over: object = {}) =>
  window.localStorage.setItem(
    KEY,
    JSON.stringify({
      days: ["2026-10-19", "2026-10-20"],
      asks: 0,
      snoozed_until: 0,
      done: false,
      ...over,
    })
  );
const stored = () => JSON.parse(window.localStorage.getItem(KEY)!);
const card = () => screen.queryByRole("complementary", { name: /github/i });
const wait = () => act(() => vi.advanceTimersByTime(ASK_DELAY_MS));

describe("GithubStarCard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    window.localStorage.clear();
    nav.pathname = "/dashboard";
  });
  afterEach(() => vi.useRealTimers());

  it("records today's visit on load", () => {
    seed();
    render(<GithubStarCard />);
    expect(stored().days).toEqual(["2026-10-19", "2026-10-20", "2026-10-21"]);
  });

  it("appears on any page", async () => {
    seed();
    nav.pathname = "/links";
    render(<GithubStarCard />);
    await wait();
    expect(card()).toBeInTheDocument();
  });

  it("waits while a dialog is open and tries again on the next page", async () => {
    seed();
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.appendChild(dialog);
    const { rerender } = render(<GithubStarCard />);
    await wait();
    expect(card()).toBeNull();
    expect(stored().asks).toBe(0);
    dialog.remove();
    nav.pathname = "/links";
    rerender(<GithubStarCard />);
    await wait();
    expect(card()).toBeInTheDocument();
    expect(stored().asks).toBe(1);
  });

  it("stays hidden before the third day", async () => {
    seed({ days: ["2026-10-20"] });
    render(<GithubStarCard />);
    await wait();
    expect(card()).toBeNull();
  });

  it("appears after the delay and counts the ask", async () => {
    seed();
    render(<GithubStarCard />);
    act(() => vi.advanceTimersByTime(ASK_DELAY_MS - 1));
    expect(card()).toBeNull();
    await act(() => vi.advanceTimersByTime(1));
    expect(card()).toBeInTheDocument();
    expect(screen.getByText("Enjoying Grovs?")).toBeInTheDocument();
    expect(stored().asks).toBe(1);
  });

  it("Star opens the repo and never shows again", async () => {
    seed();
    const { unmount } = render(<GithubStarCard />);
    await wait();
    const link = screen.getByRole("link", { name: /star on github/i });
    expect(link).toHaveAttribute("href", REPO_URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    fireEvent.click(link);
    expect(card()).toBeNull();
    expect(stored().done).toBe(true);
    unmount();
    vi.setSystemTime(NOW.getTime() + 60 * DAY);
    render(<GithubStarCard />);
    await wait();
    expect(card()).toBeNull();
  });

  it.each(["Later", "Close"])("%s snoozes for 30 days", async (name) => {
    seed();
    render(<GithubStarCard />);
    await wait();
    fireEvent.click(screen.getByRole("button", { name }));
    expect(card()).toBeNull();
    expect(stored().snoozed_until).toBe(Date.now() + 30 * DAY);
  });

  it("stays open across page changes without asking again", async () => {
    seed();
    const { rerender } = render(<GithubStarCard />);
    await wait();
    nav.pathname = "/links";
    rerender(<GithubStarCard />);
    await wait();
    expect(card()).toBeInTheDocument();
    expect(stored().asks).toBe(1);
  });

  it("stops after three asks", async () => {
    seed({ asks: 3 });
    render(<GithubStarCard />);
    await wait();
    expect(card()).toBeNull();
  });
});
