import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { instance, makeData, mutation } from "./fixtures";

const m = vi.hoisted(() => ({
  domain: {
    id: "d1",
    subdomain: "segdemo",
    domain: "sqd.link",
    generic_title: undefined as string | undefined,
  },
  defaults: {
    generic_title: "grovs",
    generic_subtitle: "Dynamic links, attributions, and referrals",
    generic_image_url: "https://cdn/placeholder.jpg",
  },
}));

const muts = vi.hoisted(() => ({
  setDefault: null as unknown as ReturnType<
    typeof import("./fixtures").mutation
  >,
  setRedirect: null as unknown as ReturnType<
    typeof import("./fixtures").mutation
  >,
  setSubdomain: null as unknown as ReturnType<
    typeof import("./fixtures").mutation
  >,
}));

vi.mock("@/hooks/queries/useConfigurationQueries", () => ({
  useDomainConfigQuery: () => ({ data: m.domain }),
  useDomainDefaultsQuery: () => ({ data: m.defaults }),
}));
vi.mock("@/hooks/mutations/useConfigurationMutations", () => ({
  useSetDefaultRedirectMutation: () => muts.setDefault,
  useSetRedirectMutation: () => muts.setRedirect,
  useSetSubdomainMutation: () => muts.setSubdomain,
}));
vi.mock("@/components/analytics/shared", () => ({
  PlatformIcon: () => <i />,
}));
vi.mock("@/lib/Notifications", () => ({ showGenericError: vi.fn() }));

import { LinksStep } from "../steps/links/LinksStep";
import { SharePreviewStep } from "../steps/links/SharePreviewStep";
import type { SetupData } from "../useSetupData";

const connected = makeData({
  platforms: { ios: { registered: true }, android: { registered: true } },
});

const renderLinks = (data: SetupData = connected) => {
  const onNext = vi.fn();
  const onConnect = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <LinksStep
        instance={instance}
        data={data}
        onBack={vi.fn()}
        onNext={onNext}
        onConnect={onConnect}
      />
    </QueryClientProvider>
  );
  return { onNext, onConnect };
};

const continueButton = () => screen.getByRole("button", { name: "Continue" });
const fallback = () => screen.getByLabelText("Default fallback");

beforeEach(() => {
  muts.setDefault = mutation();
  muts.setRedirect = mutation();
  muts.setSubdomain = mutation();
  m.domain.generic_title = undefined;
});

describe("LinksStep", () => {
  it("defaults connected iOS to the app, else the App Store", () => {
    renderLinks();
    expect(screen.getByRole("radio", { name: /Open the app/ })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByRole("radio", { name: /App Store/ })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByText("Editing")).toBeInTheDocument();
    expect(screen.getAllByText("Opens Segments Demo")).toHaveLength(2);
  });

  it("keeps Continue off until the fallback is a valid https address", () => {
    renderLinks();
    expect(continueButton()).toBeDisabled();
    expect(
      screen.getByText("Add a fallback URL to continue")
    ).toBeInTheDocument();
    expect(screen.getByText("Fallback not set")).toBeInTheDocument();
    fireEvent.blur(fallback());
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Add a fallback URL to continue."
    );
    fireEvent.change(fallback(), { target: { value: "segments" } });
    expect(continueButton()).toBeDisabled();
    fireEvent.change(fallback(), { target: { value: "segments.io" } });
    expect(continueButton()).toBeEnabled();
    expect(screen.queryByText("Fallback not set")).toBeNull();
  });

  it("asks for a page when a custom page is chosen", () => {
    renderLinks();
    fireEvent.change(fallback(), { target: { value: "segments.io" } });
    fireEvent.click(screen.getByRole("radio", { name: /Custom page/ }));
    expect(continueButton()).toBeDisabled();
    fireEvent.change(screen.getByLabelText("iOS landing page"), {
      target: { value: "segments.io/download" },
    });
    expect(continueButton()).toBeEnabled();
    fireEvent.click(screen.getByRole("radio", { name: /Open a web page/ }));
    expect(screen.queryByText("If it isn't installed")).toBeNull();
    expect(screen.getByLabelText("iOS web page")).toBeInTheDocument();
  });

  it("preselects a custom page and locks the store for a platform that isn't connected", () => {
    const { onConnect } = renderLinks(
      makeData({ platforms: { ios: { registered: true } } })
    );
    fireEvent.click(screen.getByRole("tab", { name: /Android/ }));
    expect(
      screen.getByRole("tab", { name: /Not connected/ })
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Custom page/ })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByRole("radio", { name: /Google Play/ })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
    expect(
      screen.getByText("Empty uses the fallback below.")
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Connect Android" }));
    expect(onConnect).toHaveBeenCalledWith("android");
  });

  it("offers the Grovs page or a custom page on computers", () => {
    renderLinks();
    fireEvent.click(screen.getByRole("tab", { name: /Computers/ }));
    expect(screen.getByRole("radio", { name: /Grovs page/ })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    fireEvent.click(screen.getByRole("radio", { name: /Custom page/ }));
    expect(screen.getByLabelText("Computer page")).toBeInTheDocument();
  });

  it("tucks the preview page and social browsers under Advanced", () => {
    renderLinks();
    expect(screen.queryByRole("switch", { name: "Preview page" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Advanced/ }));
    fireEvent.click(screen.getByRole("switch", { name: "Preview page" }));
    expect(screen.getByText(/Preview page on/)).toBeInTheDocument();
  });

  it("saves through the existing redirect endpoints", async () => {
    const { onNext } = renderLinks(
      makeData({ platforms: { ios: { registered: true } } })
    );
    fireEvent.change(fallback(), { target: { value: "segments.io" } });
    await act(async () => fireEvent.click(continueButton()));
    expect(muts.setDefault.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ defaultFallback: "https://segments.io" })
    );
    expect(muts.setRedirect.mutateAsync).toHaveBeenCalledWith({
      platform: "ios",
      variation: "phone",
      appstore: true,
      fallbackUrl: null,
      enabled: true,
    });
    expect(muts.setRedirect.mutateAsync).toHaveBeenCalledWith({
      platform: "android",
      variation: "phone",
      appstore: false,
      fallbackUrl: "",
      enabled: false,
    });
    expect(muts.setRedirect.mutateAsync).toHaveBeenCalledWith({
      platform: "desktop",
      variation: "desktop",
      appstore: true,
      fallbackUrl: null,
      enabled: true,
    });
    expect(onNext).toHaveBeenCalled();
  });
});

describe("SharePreviewStep", () => {
  const renderShare = () => {
    const onNext = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <SharePreviewStep
          instance={instance}
          onBack={vi.fn()}
          onNext={onNext}
        />
      </QueryClientProvider>
    );
    return { onNext };
  };

  it("shows the effective defaults as placeholders and in the preview", () => {
    renderShare();
    expect(screen.getByLabelText("Title")).toHaveAttribute(
      "placeholder",
      "grovs"
    );
    expect(screen.getByLabelText("Description")).toHaveAttribute(
      "placeholder",
      m.defaults.generic_subtitle
    );
    expect(screen.getByText("Default Grovs image")).toBeInTheDocument();
    expect(screen.getByTestId("link-card")).toHaveTextContent("grovs");
    expect(screen.getByTestId("link-card")).toHaveTextContent(
      "segdemo.sqd.link"
    );
  });

  it("updates the preview live and saves to the social preview settings", async () => {
    const { onNext } = renderShare();
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Segments" },
    });
    expect(screen.getByTestId("link-card")).toHaveTextContent("Segments");
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Done" }))
    );
    const form = muts.setSubdomain.mutateAsync.mock.calls[0]![0] as FormData;
    expect(form.get("generic_title")).toBe("Segments");
    expect(form.get("subdomain")).toBe("segdemo");
    expect(onNext).toHaveBeenCalled();
  });

  it("saving the title only doesn't re-send the existing image", async () => {
    renderShare();
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Segments" },
    });
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Done" }))
    );
    const form = muts.setSubdomain.mutateAsync.mock.calls[0]![0] as FormData;
    expect(form.has("generic_image_url")).toBe(false);
    expect(form.has("generic_image")).toBe(false);
  });

  it("skips without saving", () => {
    const { onNext } = renderShare();
    fireEvent.click(screen.getByRole("button", { name: "Skip, use defaults" }));
    expect(muts.setSubdomain.mutateAsync).not.toHaveBeenCalled();
    expect(onNext).toHaveBeenCalled();
  });
});
