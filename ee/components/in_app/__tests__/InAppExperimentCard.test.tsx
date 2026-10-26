import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/lib/ApiError";
import { inAppApi } from "@ee/api/in_app/inAppService";
import {
  ok,
  polyfillDom,
  wrap,
} from "@ee/components/push/composer/__tests__/helpers";
import {
  experimentCampaign,
  inAppCampaign,
  inAppExperiment,
} from "@ee/lib/__tests__/inAppFixtures";
import type { InAppExperiment } from "@ee/types/inApp";
import InAppExperimentCard, {
  experimentSentence,
} from "../InAppExperimentCard";

vi.mock("@ee/api/in_app/inAppService", () => ({
  inAppApi: { getExperiment: vi.fn(), duplicate: vi.fn(), step: vi.fn() },
}));
const notify = vi.hoisted(() => ({ ok: vi.fn(), bad: vi.fn() }));
vi.mock("@/lib/Notifications", () => ({
  showSuccessNotification: notify.ok,
  showErrorNotification: notify.bad,
}));

const api = vi.mocked(inAppApi);
const onDuplicated = vi.fn();

const open = (props: Partial<Parameters<typeof InAppExperimentCard>[0]> = {}) =>
  wrap(
    <InAppExperimentCard
      projectId="p1"
      campaign={experimentCampaign()}
      period={{ from: "2026-09-01", to: "2026-09-30" }}
      onDuplicated={onDuplicated}
      {...props}
    />
  );

const answer = (experiment: InAppExperiment) =>
  api.getExperiment.mockResolvedValue(ok({ experiment }) as never);
const card = () => screen.getByRole("region", { name: "Experiment" });
const rows = () => within(card()).getAllByRole("row").slice(1);

beforeEach(() => {
  vi.clearAllMocks();
  polyfillDom();
  answer(inAppExperiment());
});

describe("InAppExperimentCard", () => {
  it("waits with grey rows, then shows one row per group", async () => {
    let finish: (value: unknown) => void = () => undefined;
    api.getExperiment.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }) as never
    );
    open();
    expect(screen.getByLabelText("Loading experiment")).toHaveAttribute(
      "aria-busy",
      "true"
    );
    finish(ok({ experiment: inAppExperiment() }));
    await screen.findByText("A · Your message");
    expect(api.getExperiment).toHaveBeenCalledWith(
      "p1",
      "exp-1",
      "2026-09-01",
      "2026-09-30",
      expect.anything()
    );
    expect(rows().map((r) => r.firstElementChild!.textContent)).toEqual([
      "A · Your message",
      "B",
      "Control group",
      "Project control group",
    ]);
    expect(
      within(card())
        .getAllByRole("columnheader")
        .map((th) => th.textContent)
    ).toEqual([
      "Group",
      "People",
      "Clicked",
      "Converted",
      "Revenue",
      "Per person",
      "Confidencevs A",
      "",
    ]);
    expect(rows()[0]).toHaveTextContent("4,12061014.8%2335.7%$4,120.00$1.00—");
    expect(rows()[1]).toHaveTextContent(
      "4,09870217.1%2686.5%$4,098.00$1.0096%"
    );
    expect(rows()[2]).toHaveTextContent("Control group910—313.4%$773.50$0.85—");
    expect(card()).toHaveTextContent("Goal: checkout within 3 days");
    expect(
      screen.getByText(
        "Variants convert 83% better than the control: about +47 conversions (99% confidence)."
      )
    ).toBeInTheDocument();
  });

  it("a variant below A shows how sure it is of being worse", async () => {
    answer(
      inAppExperiment({
        groups: inAppExperiment().groups.map((g) =>
          g.id === "b" ? { ...g, conversion_rate: 0.041, confidence: 0.03 } : g
        ),
      })
    );
    open();
    await screen.findByText("A · Your message");
    expect(rows()[1]).toHaveTextContent("97%worse");
  });

  it("without a goal the converted column goes, and the sentence asks for one", async () => {
    answer(
      inAppExperiment({
        goal: null,
        lift: null,
        added_conversions: null,
        confidence: null,
        groups: inAppExperiment().groups.map((g) => ({
          ...g,
          converted: null,
          conversion_rate: null,
        })),
      })
    );
    open();
    await screen.findByText("A · Your message");
    expect(within(card()).queryByText("Converted")).toBeNull();
    expect(card()).toHaveTextContent("No goal");
    expect(
      screen.getByText(
        "Set a goal in the Experiment step to measure conversions."
      )
    ).toBeInTheDocument();
  });

  it("says when more people are needed", async () => {
    answer(inAppExperiment({ confidence: 0.7, more_people_needed: 1900 }));
    open();
    await screen.findByText("A · Your message");
    expect(
      screen.getByText(
        "Not enough people yet for a clear answer: about 1,900 more per group."
      )
    ).toBeInTheDocument();
  });

  it("shows the server's reason when the numbers cannot be read", async () => {
    api.getExperiment.mockRejectedValue(
      new ApiError("Unavailable", 503, undefined, {
        error: "The analytics store is unavailable. Try again in a minute.",
        error_code: "clickhouse_unavailable",
      })
    );
    open();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The analytics store is unavailable. Try again in a minute."
    );
  });

  it("use for everyone asks, duplicates with the variant and opens the draft", async () => {
    api.duplicate.mockResolvedValue(
      ok({ in_app_campaign: inAppCampaign({ id: "exp-1-b" }) }, 201) as never
    );
    open();
    await screen.findByText("A · Your message");
    await userEvent.click(
      screen.getByRole("button", { name: "Use variant B for everyone" })
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Use variant B for everyone?",
    });
    expect(dialog).toHaveTextContent(
      "A new draft with this content and no experiment will be created."
    );
    expect(
      within(dialog).getByRole("button", { name: "End this campaign" })
    ).toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Create the draft" })
    );
    await waitFor(() =>
      expect(api.duplicate).toHaveBeenCalledWith("p1", "exp-1", "b")
    );
    expect(onDuplicated).toHaveBeenCalledWith("exp-1-b");
    expect(notify.ok).toHaveBeenCalledWith("Draft created");
  });

  it("sends the variant for A too, so the copy drops the experiment", async () => {
    api.duplicate.mockResolvedValue(
      ok({ in_app_campaign: inAppCampaign({ id: "exp-1-a" }) }, 201) as never
    );
    open();
    await screen.findByText("A · Your message");
    await userEvent.click(
      screen.getByRole("button", { name: "Use variant A for everyone" })
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Create the draft" })
    );
    await waitFor(() =>
      expect(api.duplicate).toHaveBeenCalledWith("p1", "exp-1", "a")
    );
  });

  it("the same dialog can end the campaign instead", async () => {
    api.step.mockResolvedValue(
      ok({ in_app_campaign: experimentCampaign({ status: "ended" }) }) as never
    );
    open();
    await screen.findByText("A · Your message");
    await userEvent.click(
      screen.getByRole("button", { name: "Use variant A for everyone" })
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "End this campaign" })
    );
    await waitFor(() =>
      expect(api.step).toHaveBeenCalledWith("p1", "exp-1", "end")
    );
    expect(api.duplicate).not.toHaveBeenCalled();
  });

  it("an ended campaign is only read", async () => {
    open({ campaign: experimentCampaign({ status: "ended" }) });
    await screen.findByText("A · Your message");
    expect(screen.queryByRole("button", { name: /Use variant/ })).toBeNull();
  });

  it("a journey step is changed from its journey, so no use for everyone", async () => {
    open({
      campaign: experimentCampaign({
        audience: {
          type: "journey",
          segment_id: null,
          segment_definition_hash: null,
          segment_changed: false,
        },
      }),
    });
    await screen.findByText("A · Your message");
    expect(screen.queryByRole("button", { name: /Use variant/ })).toBeNull();
  });

  it("shows revenue per group and the revenue sentence", async () => {
    open();
    await waitFor(() => expect(rows()).toHaveLength(4));
    expect(within(rows()[0]!).getByText("$4,120.00")).toBeInTheDocument();
    expect(within(rows()[0]!).getByText("$1.00")).toBeInTheDocument();
    expect(
      within(card()).getByText(/brought about \$1,240 more than the control/)
    ).toBeInTheDocument();
  });

  it("hides the revenue columns when nobody bought anything and the goal is no purchase", async () => {
    const base = inAppExperiment();
    answer(
      inAppExperiment({
        groups: base.groups.map((g) => ({
          ...g,
          revenue_cents: 0,
          revenue_per_person_cents: 0,
        })),
        revenue_lift: null,
        added_revenue_cents: 0,
      })
    );
    open();
    await waitFor(() => expect(rows()).toHaveLength(4));
    expect(
      within(card()).queryByRole("columnheader", { name: "Revenue" })
    ).toBeNull();
    expect(within(card()).queryByText(/brought about/)).toBeNull();
  });
});

describe("experimentSentence", () => {
  const base = inAppExperiment();
  it("picks the sentence by what the data holds", () => {
    expect(experimentSentence(base, true)).toBe(
      "Variants convert 83% better than the control: about +47 conversions (99% confidence)."
    );
    // One-sided: a negative lift is sure when P(variants beat control) is near zero.
    expect(
      experimentSentence(
        { ...base, lift: -0.12, added_conversions: -9, confidence: 0.03 },
        true
      )
    ).toBe(
      "Variants convert 12% worse than the control: about -9 conversions (97% confidence)."
    );
    expect(
      experimentSentence(
        {
          ...base,
          lift: -0.12,
          added_conversions: -9,
          confidence: 0.97,
          more_people_needed: 40,
        },
        true
      )
    ).toBe(
      "Not enough people yet for a clear answer: about 40 more per group."
    );
    expect(
      experimentSentence(
        { ...base, confidence: 0.8, more_people_needed: 300 },
        true
      )
    ).toBe(
      "Not enough people yet for a clear answer: about 300 more per group."
    );
    expect(
      experimentSentence(
        { ...base, confidence: null, more_people_needed: null },
        true
      )
    ).toBe("Not enough people yet for a clear answer.");
    expect(
      experimentSentence(
        { ...base, confidence: null, more_people_needed: 250 },
        true
      )
    ).toBe(
      "Not enough people yet for a clear answer: about 250 more per group."
    );
    expect(
      experimentSentence(
        { ...base, lift: null, added_conversions: 47, confidence: 0.99 },
        true
      )
    ).toBe(
      "The message brought about +47 conversions; the control converted nobody (99% confidence)."
    );
    expect(
      experimentSentence(
        { ...base, confidence: null, more_people_needed: 0 },
        true
      )
    ).toBe("Not enough people yet for a clear answer.");
    expect(experimentSentence({ ...base, goal: null }, true)).toBe(
      "Set a goal in the Experiment step to measure conversions."
    );
    expect(experimentSentence({ ...base, goal: null }, false)).toBe(
      "No goal was set."
    );
    expect(
      experimentSentence({ ...base, control_group: null }, true)
    ).toBeNull();
  });
});
