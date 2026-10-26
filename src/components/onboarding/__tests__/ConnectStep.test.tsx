import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { instance, iosConfig, makeData, mutation } from "./fixtures";

const muts = vi.hoisted(() => ({
  complete: null as unknown as ReturnType<typeof import("./fixtures").mutation>,
  ios: null as unknown as ReturnType<typeof import("./fixtures").mutation>,
  android: null as unknown as ReturnType<typeof import("./fixtures").mutation>,
  web: null as unknown as ReturnType<typeof import("./fixtures").mutation>,
  push: null as unknown as ReturnType<typeof import("./fixtures").mutation>,
  invite: null as unknown as ReturnType<typeof import("./fixtures").mutation>,
}));

vi.mock("@/lib/edition", () => ({
  IS_ENTERPRISE: true,
  IS_SELF_HOSTED: false,
}));
vi.mock("@/hooks/mutations/useInstanceMutations", () => ({
  useCompleteSetupStepMutation: () => muts.complete,
  useSetIosConfigMutation: () => muts.ios,
  useSetAndroidConfigMutation: () => muts.android,
  useSetWebConfigMutation: () => muts.web,
  useSetIosPushConfigMutation: () => muts.push,
  useSetAndroidPushConfigMutation: () => muts.push,
  useSetAndroidWebhookKeyMutation: () => muts.push,
  useAddMemberMutation: () => muts.invite,
}));
vi.mock("@/hooks/queries/useInstanceQueries", () => ({
  useGoogleConfigScriptQuery: () => ({ data: undefined }),
  useInstanceMembersQuery: () => ({
    data: { members: [{ user: { email: "already@segments.io" } }] },
  }),
}));
vi.mock("@/hooks/queries/useAndroidSdkReleaseQuery", () => ({
  useAndroidSdkReleaseQuery: () => ({ data: "1.2.3" }),
}));
vi.mock("@/context/useUserContext", () => ({
  useUserContext: () => ({ user: { email: "me@segments.io" } }),
}));
vi.mock("@/hooks/queries/useConfigurationQueries", () => ({
  useCustomDomainsQuery: () => ({ data: [] }),
}));
vi.mock("@/components/analytics/shared", () => ({
  PlatformIcon: () => <i />,
}));
vi.mock("@/lib/Notifications", () => ({
  showGenericError: vi.fn(),
  showSuccessNotification: vi.fn(),
  showErrorNotification: vi.fn(),
}));
vi.mock("@/analytics", () => ({ trackEvent: vi.fn(), EVENTS: {} }));
vi.mock("@/lib/config", () => ({
  config: { apiUrl: "https://api.grovs.io" },
}));

import { ConnectStep } from "../steps/connect/ConnectStep";
import { IOS_SPM_URL } from "@/lib/IosPageConstants";
import type { SetupData } from "../useSetupData";
import type { Platform } from "../setupRules";

const walkedAll = new Set(["url_scheme", "add_sdk", "initialize_sdk"]);

const renderStep = (data: SetupData, platform: Platform = "ios") => {
  const onNext = vi.fn();
  const onPlatform = vi.fn();
  const utils = render(
    <ConnectStep
      instance={instance}
      data={data}
      platform={platform}
      onPlatform={onPlatform}
      onBack={vi.fn()}
      onNext={onNext}
    />
  );
  return { ...utils, onNext, onPlatform };
};

const continueButton = () => screen.getByRole("button", { name: "Continue" });

beforeEach(() => {
  muts.complete = mutation();
  muts.ios = mutation();
  muts.android = mutation();
  muts.web = mutation();
  muts.push = mutation();
  muts.invite = mutation();
});

describe("ConnectStep", () => {
  it("starts on the app IDs and saves them through the iOS config endpoint", async () => {
    renderStep(makeData());
    expect(
      screen.getByRole("button", { name: /Your app's IDs/, expanded: true })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Bundle ID", { selector: "h5" })
    ).toBeInTheDocument();
    expect(continueButton()).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Bundle ID"), {
      target: { value: "io.segments.demo" },
    });
    fireEvent.change(screen.getByLabelText("Team ID"), {
      target: { value: "8k3j2q9x7p" },
    });
    expect(continueButton()).toBeEnabled();
    await act(async () => fireEvent.click(continueButton()));
    expect(muts.ios.mutateAsync).toHaveBeenCalledWith({
      enabled: true,
      bundle_id: "io.segments.demo",
      app_prefix: "8K3J2Q9X7P",
    });
    expect(
      screen.getByRole("button", {
        name: /Add your domain to the app/,
        expanded: true,
      })
    ).toBeInTheDocument();
  });

  it("lists the associated domains and URL scheme, and records the part", async () => {
    renderStep(
      makeData({
        platforms: { ios: { registered: true, config: iosConfig() } },
      })
    );
    expect(screen.getByText("applinks:segdemo.sqd.link")).toBeInTheDocument();
    expect(
      screen.getByText("applinks:segdemo.test-sqd.link")
    ).toBeInTheDocument();
    expect(screen.getByText("segmenscheme")).toBeInTheDocument();
    expect(screen.getByText("io.segments.demo")).toBeInTheDocument();
    await act(async () => fireEvent.click(continueButton()));
    expect(muts.complete.mutateAsync).toHaveBeenCalledWith({
      category: "ios_setup",
      stepIdentifier: "url_scheme",
    });
  });

  it("records the open part when another part is clicked", async () => {
    renderStep(
      makeData({
        platforms: { ios: { registered: true, config: iosConfig() } },
      })
    );
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: /Install the SDK/ }))
    );
    expect(muts.complete.mutateAsync).toHaveBeenCalledWith({
      category: "ios_setup",
      stepIdentifier: "url_scheme",
    });
  });

  it("does not save the app IDs on click-away while they are invalid", async () => {
    renderStep(makeData());
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: /Install the SDK/ }))
    );
    expect(muts.ios.mutateAsync).not.toHaveBeenCalled();
  });

  it("saves the app IDs once both are filled and the field is left", async () => {
    renderStep(makeData());
    fireEvent.change(screen.getByLabelText("Bundle ID"), {
      target: { value: "io.segments.demo" },
    });
    const team = screen.getByLabelText("Team ID");
    fireEvent.change(team, { target: { value: "8k3j2q9x7p" } });
    await act(async () => fireEvent.blur(team));
    expect(muts.ios.mutateAsync).toHaveBeenCalledTimes(1);
  });

  it("records a part as soon as something in it is copied", async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn(() => Promise.resolve()) },
    });
    renderStep(
      makeData({
        platforms: { ios: { registered: true, config: iosConfig() } },
      })
    );
    await act(async () =>
      fireEvent.click(screen.getAllByRole("button", { name: /copy/i })[0]!)
    );
    expect(muts.complete.mutateAsync).toHaveBeenCalledWith({
      category: "ios_setup",
      stepIdentifier: "url_scheme",
    });
  });

  it("adds file:// for an Electron app on Web", () => {
    renderStep(makeData(), "web");
    fireEvent.click(screen.getByRole("button", { name: /Electron app/ }));
    expect(screen.getByLabelText("Website 1")).toHaveValue("file://");
    expect(
      screen.queryByRole("button", { name: /Electron app/ })
    ).not.toBeInTheDocument();
  });

  it("shows the real start code with the API key and marks the lines to add", () => {
    renderStep(
      makeData({
        platforms: {
          ios: {
            registered: true,
            config: iosConfig(),
            walked: new Set(["url_scheme", "add_sdk"]),
          },
        },
      })
    );
    expect(screen.getByText("AppDelegate.swift")).toBeInTheDocument();
    expect(screen.getByText(/segmen_key/)).toBeInTheDocument();
    expect(document.querySelectorAll("[data-added]").length).toBeGreaterThan(3);
    fireEvent.click(screen.getByRole("tab", { name: "Scene Delegate" }));
    expect(screen.getByText("SceneDelegate.swift")).toBeInTheDocument();
  });

  it("waits for the app with Continue disabled", () => {
    renderStep(
      makeData({
        platforms: {
          ios: { registered: true, config: iosConfig(), walked: walkedAll },
        },
      })
    );
    expect(screen.getAllByText("Waiting for your app to open")).toHaveLength(1);
    expect(screen.getByText("Waiting for your app")).toBeInTheDocument();
    expect(screen.getByText("Waiting for first open")).toBeInTheDocument();
    expect(continueButton()).toBeDisabled();
  });

  it("offers Skip for now on the run part while nothing is connected", () => {
    const { onNext } = renderStep(
      makeData({
        platforms: {
          ios: { registered: true, config: iosConfig(), walked: walkedAll },
        },
      })
    );
    expect(continueButton()).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    expect(onNext).toHaveBeenCalled();
  });

  it.each([
    ["the app is connected", { appConnected: true }],
    ["app_connected is recorded", { appMarked: true }],
  ])("hides Skip for now and continues when %s", (_, over) => {
    const { onNext } = renderStep(
      makeData({
        signals: { ...makeData().signals, ...over },
        platforms: {
          ios: { registered: true, config: iosConfig(), walked: walkedAll },
        },
      })
    );
    expect(screen.queryByRole("button", { name: "Skip for now" })).toBeNull();
    fireEvent.click(continueButton());
    expect(onNext).toHaveBeenCalled();
  });

  it("hides Skip for now before the run part", () => {
    renderStep(makeData());
    expect(screen.queryByRole("button", { name: "Skip for now" })).toBeNull();
  });

  it("collapses to done once the app connects and continues to Links", () => {
    const { onNext } = renderStep(
      makeData({
        signals: { ...makeData().signals, appConnected: true },
        platforms: {
          ios: {
            registered: true,
            config: iosConfig(),
            walked: walkedAll,
            seen: true,
            seenAt: new Date().toISOString(),
          },
        },
      })
    );
    expect(screen.getByText("Required setup done")).toBeInTheDocument();
    expect(screen.getByText("First open")).toBeInTheDocument();
    expect(
      screen.getAllByRole("img", { name: "Connected" }).length
    ).toBeGreaterThan(0);
    fireEvent.click(continueButton());
    expect(onNext).toHaveBeenCalled();
  });

  it("shows the parts again from Show", () => {
    renderStep(
      makeData({
        platforms: {
          ios: {
            registered: true,
            config: iosConfig(),
            walked: walkedAll,
            seen: true,
          },
        },
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(screen.getByText("Run your app")).toBeInTheDocument();
  });

  it("continues from the run part once another platform connected", () => {
    const { onNext } = renderStep(
      makeData({
        signals: { ...makeData().signals, appConnected: true },
        platforms: {
          ios: { registered: true, config: iosConfig(), walked: walkedAll },
        },
      })
    );
    expect(screen.getByText("Waiting for first open")).toBeInTheDocument();
    fireEvent.click(continueButton());
    expect(onNext).toHaveBeenCalled();
  });

  it("ticks App registered only once registered and drops Install recorded", () => {
    const registeredRow = () =>
      screen.getByText("App registered").parentElement!;
    const { unmount } = renderStep(
      makeData({
        platforms: {
          ios: { registered: true, config: iosConfig(), walked: walkedAll },
        },
      })
    );
    expect(within(registeredRow()).getByRole("img")).toBeInTheDocument();
    expect(screen.queryByText("Install recorded")).not.toBeInTheDocument();
    unmount();
    renderStep(makeData({ platforms: { ios: { walked: walkedAll } } }));
    fireEvent.click(screen.getByRole("button", { name: /Run your app/ }));
    expect(within(registeredRow()).queryByRole("img")).not.toBeInTheDocument();
  });

  it("shows the iOS Swift package URL", () => {
    renderStep(
      makeData({
        platforms: {
          ios: {
            registered: true,
            config: iosConfig(),
            walked: new Set(["url_scheme"]),
          },
        },
      })
    );
    expect(IOS_SPM_URL).toBe("https://github.com/grovs-io/grovs-iOS.git");
    expect(screen.getByText(IOS_SPM_URL)).toBeInTheDocument();
  });

  it("lets an untouched platform wait when another is connected", () => {
    const { onNext } = renderStep(
      makeData({
        signals: { ...makeData().signals, appConnected: true },
        platforms: { ios: { registered: true, seen: true, walked: walkedAll } },
      }),
      "android"
    );
    expect(screen.getByLabelText("Package name")).toBeInTheDocument();
    fireEvent.click(continueButton());
    expect(onNext).toHaveBeenCalled();
  });

  it("counts parts per platform and labels Web optional", () => {
    renderStep(
      makeData({
        platforms: { ios: { registered: true, config: iosConfig() } },
      })
    );
    const tabs = screen.getByRole("tablist", { name: "Platform" });
    expect(
      within(tabs).getByRole("tab", { name: /iOS\s*1\/5/ })
    ).toBeInTheDocument();
    expect(
      within(tabs).getByRole("tab", { name: /Android\s*0\/5/ })
    ).toBeInTheDocument();
    expect(
      within(tabs).getByRole("tab", { name: /Web\s*Optional/ })
    ).toBeInTheDocument();
  });

  it("shows the compact bar once the header scrolls away", () => {
    renderStep(makeData());
    const left = screen.getByTestId("setup-left");
    const bar = screen.getAllByRole("tablist", {
      name: "Platform",
      hidden: true,
    })[0]!.parentElement!;
    expect(bar).toHaveAttribute("aria-hidden", "true");
    left.scrollTop = 400;
    fireEvent.scroll(left);
    expect(bar).toHaveAttribute("aria-hidden", "false");
  });

  it("opens push and revenue as optional extras", () => {
    renderStep(
      makeData({
        platforms: { ios: { registered: true, config: iosConfig() } },
      })
    );
    const [push, revenue] = screen.getAllByRole("button", { name: "Set up" });
    fireEvent.click(push!);
    expect(screen.getByText("AuthKey_XXXXXXXXXX.p8")).toBeInTheDocument();
    expect(screen.getByLabelText("Team ID")).toHaveValue("8K3J2Q9X7P");
    expect(screen.getByText("Create an APNs key")).toBeInTheDocument();
    fireEvent.click(revenue!);
    expect(
      screen.getByText("https://api.grovs.io/api/v1/iap/apple/production/ph1")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Waiting for the first purchase notification")
    ).toBeInTheDocument();
  });

  it("invites a developer and hands over a link back to this step", async () => {
    renderStep(makeData());
    fireEvent.click(
      screen.getByRole("button", { name: /Send to your developer/ })
    );
    fireEvent.change(screen.getByLabelText("Their email"), {
      target: { value: "dev@segments.io" },
    });
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Send invite" }))
    );
    expect(muts.invite.mutateAsync).toHaveBeenCalledWith({
      email: "dev@segments.io",
      role: "member",
    });
    expect(
      screen.getByText(/\/setup\?instance_id=i1&step=app&platform=ios/)
    ).toBeInTheDocument();
  });

  it("skips the invite for someone already in the project", async () => {
    renderStep(makeData());
    fireEvent.click(
      screen.getByRole("button", { name: /Send to your developer/ })
    );
    fireEvent.change(screen.getByLabelText("Their email"), {
      target: { value: "Already@segments.io" },
    });
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Send invite" }))
    );
    expect(muts.invite.mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByText(/is already in the project/)).toBeInTheDocument();
  });

  it("refuses the user's own email", async () => {
    renderStep(makeData());
    fireEvent.click(
      screen.getByRole("button", { name: /Send to your developer/ })
    );
    fireEvent.change(screen.getByLabelText("Their email"), {
      target: { value: "me@segments.io" },
    });
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Send invite" }))
    );
    expect(muts.invite.mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByText(/your own email/)).toBeInTheDocument();
  });
});
