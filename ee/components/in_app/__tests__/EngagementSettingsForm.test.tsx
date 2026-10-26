import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { inAppApi } from "@ee/api/in_app/inAppService";
import {
  ok,
  polyfillDom,
  wrap,
} from "@ee/components/push/composer/__tests__/helpers";
import EngagementSettingsForm from "../EngagementSettingsForm";

vi.mock("@ee/api/in_app/inAppService", () => ({
  inAppApi: { updateSettings: vi.fn() },
}));
vi.mock("@/lib/Notifications", () => ({
  showSuccessNotification: vi.fn(),
  showErrorNotification: vi.fn(),
}));

const settings = {
  enabled: true,
  session_cap: 10,
  day_cap: 10,
  control_group: 0,
};
const api = vi.mocked(inAppApi);

const open = () =>
  wrap(<EngagementSettingsForm projectId="p1" settings={settings} />);

beforeEach(() => {
  vi.clearAllMocks();
  polyfillDom();
  api.updateSettings.mockResolvedValue(
    ok({ in_app_settings: settings }) as never
  );
});

const save = () =>
  userEvent.click(screen.getByRole("button", { name: /Save Changes/ }));
const OFF = /^Off\. No device shows any message/;
const ON = /^On\. Switch off to stop/;

describe("EngagementSettingsForm", () => {
  it("lists the shared settings first, then the in-app ones", () => {
    open();
    expect(
      screen.getByRole("heading", { level: 2, name: "Engagement Settings" })
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)
    ).toEqual([
      "Control group",
      "Pushes per person per day",
      "In-app messages",
      "Limit on in-app messages together",
    ]);
  });

  it("shows no save bar until something changes", () => {
    open();
    expect(screen.queryByRole("button", { name: /Save Changes/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Discard/ })).toBeNull();
  });

  it("saves what was changed", async () => {
    open();
    await userEvent.click(screen.getByRole("switch"));
    expect(screen.getByText(OFF)).toBeInTheDocument();
    const day = screen.getByLabelText("Messages in one day");
    await userEvent.clear(day);
    await userEvent.type(day, "3");
    await save();
    await waitFor(() =>
      expect(api.updateSettings).toHaveBeenCalledWith("p1", {
        enabled: false,
        session_cap: 10,
        day_cap: 3,
        control_group: 0,
        push_daily_cap: null,
      })
    );
  });

  it("a change put back is no change", async () => {
    open();
    await userEvent.click(screen.getByRole("switch"));
    expect(screen.getByRole("button", { name: /Save Changes/ })).toBeEnabled();
    await userEvent.click(screen.getByRole("switch"));
    expect(screen.queryByRole("button", { name: /Save Changes/ })).toBeNull();
  });

  it("discards unsaved changes without saving", async () => {
    open();
    await userEvent.click(screen.getByRole("switch"));
    await userEvent.click(screen.getByRole("button", { name: /Discard/ }));
    expect(screen.getByText(ON)).toBeInTheDocument();
    expect(api.updateSettings).not.toHaveBeenCalled();
  });

  it("a control group is a share of people who get no message at all", async () => {
    open();
    expect(screen.getByText(/Hold back a share of people/)).toBeInTheDocument();
    const control = screen.getByRole("combobox", { name: "Control group" });
    expect(control).toHaveTextContent("No one held back");
    expect(screen.getByText(/no baseline to compare/)).toBeInTheDocument();
    await userEvent.click(control);
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "No one held back",
      "1% held back",
      "2% held back",
      "5% held back",
      "10% held back",
      "20% held back",
    ]);
    await userEvent.click(screen.getByRole("option", { name: "5% held back" }));
    expect(
      screen.getByText(
        "5% of people receive no in-app messages or pushes at all; the other 95% get them as usual."
      )
    ).toBeInTheDocument();
    await save();
    await waitFor(() =>
      expect(api.updateSettings).toHaveBeenCalledWith("p1", {
        ...settings,
        control_group: 5,
        push_daily_cap: null,
      })
    );
  });

  it("caps pushes per person per day, for campaigns and journeys", async () => {
    open();
    expect(
      screen.getByText("Applies to every push: campaigns and journeys.")
    ).toBeInTheDocument();
    const cap = screen.getByLabelText("Pushes per person per day");
    expect(cap).toHaveValue("");
    expect(cap).toHaveAttribute("placeholder", "No limit");
    await userEvent.type(cap, "4");
    await save();
    await waitFor(() =>
      expect(api.updateSettings).toHaveBeenCalledWith("p1", {
        ...settings,
        push_daily_cap: 4,
      })
    );
  });

  it("keeps the push limit within what the server accepts, and empty is no limit", async () => {
    wrap(
      <EngagementSettingsForm
        projectId="p1"
        settings={{ ...settings, push_daily_cap: 5 }}
      />
    );
    const cap = screen.getByLabelText("Pushes per person per day");
    expect(cap).toHaveValue("5");
    await userEvent.clear(cap);
    await userEvent.type(cap, "80");
    expect(cap).toHaveValue("50");
    await userEvent.clear(cap);
    await save();
    await waitFor(() =>
      expect(api.updateSettings).toHaveBeenCalledWith(
        "p1",
        expect.objectContaining({ push_daily_cap: null })
      )
    );
  });

  it("a member can change the settings", async () => {
    open();
    await userEvent.click(screen.getByRole("switch"));
    await save();
    await waitFor(() =>
      expect(api.updateSettings).toHaveBeenCalledWith(
        "p1",
        expect.objectContaining({ enabled: false })
      )
    );
    expect(screen.queryByText(/Only an admin/)).toBeNull();
  });
});
