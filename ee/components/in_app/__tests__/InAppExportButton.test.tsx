import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/lib/ApiError";
import { inAppApi } from "@ee/api/in_app/inAppService";
import { ok, wrap } from "@ee/components/push/composer/__tests__/helpers";
import InAppExportButton from "../InAppExportButton";

vi.mock("@ee/api/in_app/inAppService", () => ({
  inAppApi: { answers: vi.fn() },
}));
const notify = vi.hoisted(() => ({ ok: vi.fn(), bad: vi.fn() }));
vi.mock("@/lib/Notifications", () => ({
  showSuccessNotification: notify.ok,
  showErrorNotification: notify.bad,
}));

const api = vi.mocked(inAppApi);
const period = { from: "2026-09-16", to: "2026-09-29" };
const rows = [
  {
    at: "2026-09-20T10:00:00Z",
    platform: "ios",
    country: "RO",
    app_version: "2.1.0",
    answer: "4",
    label: "4",
    comment: "Fine",
    user: null,
  },
];
const found = (over = {}) =>
  ok({ answers: { type: "stars", truncated: false, rows, ...over } }) as never;

let saved: { name: string; blob: Blob } | null;

const show = (count: number | undefined) =>
  wrap(
    <InAppExportButton
      projectId="p1"
      campaign={{ id: "ask-1", name: "Rate the app" }}
      period={period}
      count={count}
    />
  );
const button = () => screen.getByRole("button", { name: "Export" });

beforeEach(() => {
  vi.clearAllMocks();
  saved = null;
  let blob: Blob | null = null;
  URL.createObjectURL = vi.fn((made: Blob) => {
    blob = made;
    return "blob:answers";
  });
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement
  ) {
    saved = { name: this.download, blob: blob! };
  });
});

describe("InAppExportButton", () => {
  it("has nothing to export from a period with no answers", () => {
    show(0);
    expect(button()).toBeDisabled();
    expect(button()).toHaveAttribute("title", "No answers in this period");
  });

  it("waits for the report to know", () => {
    show(undefined);
    expect(button()).toBeDisabled();
    expect(button()).not.toHaveAttribute("title");
  });

  it("downloads the answers of the period that is shown", async () => {
    api.answers.mockResolvedValue(found());
    show(6);
    await userEvent.click(button());
    await waitFor(() => expect(notify.ok).toHaveBeenCalled());
    expect(api.answers).toHaveBeenCalledWith("p1", "ask-1", period);
    expect(saved?.name).toBe(
      "rate-the-app-answers-2026-09-16-to-2026-09-29.csv"
    );
    expect(saved?.blob.type).toBe("text/csv;charset=utf-8");
    expect(await saved?.blob.text()).toContain('"4","Fine"');
    expect(notify.ok).toHaveBeenCalledWith("Exported 1 answer");
  });

  it("lets the download start before the file's address is dropped", async () => {
    const timer = vi.spyOn(globalThis, "setTimeout");
    api.answers.mockResolvedValue(found());
    show(6);
    await userEvent.click(button());
    await waitFor(() => expect(saved).not.toBeNull());
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    const deferred = timer.mock.calls.find(([, ms]) => ms === 1000);
    expect(deferred).toBeDefined();
    (deferred![0] as () => void)();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:answers");
  });

  it("exports the period that was shown when clicked, however it changes meanwhile", async () => {
    let answer: (value: unknown) => void = () => undefined;
    api.answers.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }) as never
    );
    const client = new QueryClient();
    const at = (shown: typeof period) => (
      <QueryClientProvider client={client}>
        <InAppExportButton
          projectId="p1"
          campaign={{ id: "ask-1", name: "Rate the app" }}
          period={shown}
          count={6}
        />
      </QueryClientProvider>
    );
    const { rerender } = render(at(period));
    await userEvent.click(button());
    rerender(at({ from: "2026-09-01", to: "2026-09-02" }));
    answer(found());
    await waitFor(() => expect(notify.ok).toHaveBeenCalled());
    expect(api.answers).toHaveBeenCalledTimes(1);
    expect(api.answers).toHaveBeenCalledWith("p1", "ask-1", period);
    expect(saved?.name).toBe(
      "rate-the-app-answers-2026-09-16-to-2026-09-29.csv"
    );
  });

  it("counts what it exported", async () => {
    api.answers.mockResolvedValue(found({ rows: [...rows, ...rows] }));
    show(2);
    await userEvent.click(button());
    await waitFor(() =>
      expect(notify.ok).toHaveBeenCalledWith("Exported 2 answers")
    );
  });

  it("says when there were more than it could export", async () => {
    api.answers.mockResolvedValue(found({ truncated: true }));
    show(20000);
    await userEvent.click(button());
    await waitFor(() =>
      expect(notify.ok).toHaveBeenCalledWith(
        "Exported the newest 10,000 answers. Choose a shorter period for the rest."
      )
    );
  });

  it("cannot be clicked twice while it runs", async () => {
    api.answers.mockReturnValue(new Promise(() => undefined) as never);
    show(6);
    await userEvent.click(button());
    await waitFor(() => expect(button()).toBeDisabled());
    expect(api.answers).toHaveBeenCalledTimes(1);
  });

  it("shows the server's reason when it fails", async () => {
    api.answers.mockRejectedValue(
      new ApiError("Invalid", 422, undefined, {
        error: "This campaign asks no question",
      })
    );
    show(6);
    await userEvent.click(button());
    await waitFor(() =>
      expect(notify.bad).toHaveBeenCalledWith("This campaign asks no question")
    );
    expect(saved).toBeNull();
    expect(button()).toBeEnabled();
  });
});
