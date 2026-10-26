import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { pushApi } from "@ee/api/push/pushCampaignsService";
import { inAppExperiment } from "@ee/lib/__tests__/inAppFixtures";
import type { PushCampaign } from "@ee/types/push";
import PushExperimentCard from "../PushExperimentCard";
import {
  draftCampaign,
  ok,
  polyfillDom,
  wrap,
} from "../composer/__tests__/helpers";

vi.mock("@ee/api/push/pushCampaignsService", () => ({
  pushApi: { getExperiment: vi.fn(), sendWinner: vi.fn() },
}));
const notify = vi.hoisted(() => ({ ok: vi.fn(), bad: vi.fn() }));
vi.mock("@/lib/Notifications", () => ({
  showSuccessNotification: notify.ok,
  showErrorNotification: notify.bad,
}));

const api = vi.mocked(pushApi);

const sent = (over: Partial<PushCampaign> = {}): PushCampaign => {
  const base = draftCampaign({
    id: "k9Qx2",
    status: "sent",
    control_group: 10,
    variants: [{ id: "b", title: "Hi", body: "Sale on" }],
    test_share: 20,
  });
  return {
    ...base,
    report: { ...base.report, waiting: 3120 },
    ...over,
  };
};

const open = (campaign = sent()) =>
  wrap(<PushExperimentCard projectId="p1" campaign={campaign} />);
const card = () => screen.getByRole("region", { name: "Experiment" });

beforeEach(() => {
  vi.clearAllMocks();
  polyfillDom();
  api.getExperiment.mockResolvedValue(
    ok({ experiment: inAppExperiment({ test_share: 20 }) }) as never
  );
  api.sendWinner.mockResolvedValue(
    ok({ push_campaign: sent({ status: "sending" }) }, 202) as never
  );
});

describe("PushExperimentCard", () => {
  it("counts opens, asks without a range, and offers the rest to each variant", async () => {
    open();
    await screen.findByText("A · Your message");
    expect(api.getExperiment).toHaveBeenCalledWith(
      "p1",
      "k9Qx2",
      undefined,
      undefined,
      expect.anything()
    );
    expect(
      within(card())
        .getAllByRole("columnheader")
        .map((th) => th.textContent)
    ).toEqual([
      "Group",
      "People",
      "Opened",
      "Converted",
      "Revenue",
      "Per person",
      "Confidencevs A",
      "",
    ]);
    expect(
      screen.getAllByRole("button", { name: /Send variant . to the rest/ })
    ).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /for everyone/ })).toBeNull();
  });

  it("send to the rest asks, then sends the winner", async () => {
    open();
    await screen.findByText("A · Your message");
    await userEvent.click(
      screen.getByRole("button", { name: "Send variant B to the rest" })
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Send variant B to the 3,120 people waiting?",
    });
    expect(dialog).toHaveTextContent("This cannot be undone.");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Send to the rest" })
    );
    await waitFor(() =>
      expect(api.sendWinner).toHaveBeenCalledWith("p1", "k9Qx2", "b")
    );
    expect(notify.ok).toHaveBeenCalledWith("Sending to the rest");
  });

  it("offers nothing when nobody waits, or while the rest is being sent", async () => {
    const nothing = sent();
    open({ ...nothing, report: { ...nothing.report, waiting: 0 } });
    await screen.findByText("A · Your message");
    expect(screen.queryByRole("button", { name: /to the rest/ })).toBeNull();
  });

  it("offers nothing once a winner was sent, by hand or by the timer", async () => {
    open(sent({ status: "sent", winner: "b" }));
    await screen.findByText("A · Your message");
    expect(screen.queryByRole("button", { name: /to the rest/ })).toBeNull();
    expect(screen.queryByText("Sending to the rest…")).toBeNull();
  });

  it("says the rest is on its way on the winner's row only", async () => {
    open(sent({ status: "sending", winner: "b" }));
    await screen.findByText("A · Your message");
    expect(screen.queryByRole("button", { name: /to the rest/ })).toBeNull();
    expect(screen.getAllByText("Sending to the rest…")).toHaveLength(1);
    expect(
      within(screen.getAllByRole("row")[2]!).getByText("Sending to the rest…")
    ).toBeInTheDocument();
  });

  it("says nothing while the first send is still going out", async () => {
    open(sent({ status: "sending" }));
    await screen.findByText("A · Your message");
    expect(screen.queryByText("Sending to the rest…")).toBeNull();
  });
});
