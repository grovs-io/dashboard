import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { instance, iosConfig, makeData, mutation, signals } from "./fixtures";

const m = vi.hoisted(() => ({
  opened: null as null | Record<string, string | null>,
  createLink: null as unknown as ReturnType<
    typeof import("./fixtures").mutation
  >,
}));

vi.mock("@/hooks/queries/useConfigurationQueries", () => ({
  useDomainConfigQuery: () => ({
    data: { id: "d1", subdomain: "segdemo", domain: "sqd.link" },
  }),
  useDomainDefaultsQuery: () => ({
    data: {
      generic_title: "grovs",
      generic_subtitle: "",
      generic_image_url: "",
    },
  }),
}));
vi.mock("@/hooks/queries/useLinksQueries", () => ({
  useLinkLastOpenQuery: () => ({ data: m.opened }),
}));
vi.mock("@/hooks/mutations/useLinksMutations", () => ({
  useCreateLinkMutation: () => m.createLink,
}));
vi.mock("@/api/links/linksService", () => ({
  availablePathAPICall: vi.fn(() =>
    Promise.resolve({ data: { available: true } })
  ),
  getRandomPathAPICall: vi.fn(() =>
    Promise.resolve({ data: { valid_path: "x1" } })
  ),
}));
vi.mock("@/context/useUserContext", () => ({
  useUserContext: () => ({ user: { email: "me@segments.io" } }),
}));
vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));
vi.mock("qrcode.react", () => ({
  QRCodeSVG: ({ value }: { value: string }) => (
    <svg data-testid="qr" data-value={value} />
  ),
}));

import { TryStep, describeOpen } from "../steps/TryStep";
import { DoneStep } from "../steps/DoneStep";

beforeEach(() => {
  localStorage.clear();
  m.opened = null;
  m.createLink = mutation(() =>
    Promise.resolve({
      data: {
        link: {
          id: 7,
          name: "Summer sale",
          path: "summer-sale",
          access_path: "https://segdemo.sqd.link/summer-sale",
        },
      },
    })
  );
});

const renderTry = () => {
  const onFinish = vi.fn();
  const utils = render(
    <TryStep instance={instance} onBack={vi.fn()} onFinish={onFinish} />
  );
  return { ...utils, onFinish };
};

describe("TryStep", () => {
  it("creates the first link with its data and shows it with a QR code", async () => {
    renderTry();
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Summer sale" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add data" }));
    fireEvent.change(screen.getByLabelText("Key 1"), {
      target: { value: "promo" },
    });
    fireEvent.change(screen.getByLabelText("Value 1"), {
      target: { value: "SUMMER20" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add data" }));
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Create link" }))
    );
    const form = m.createLink.mutateAsync.mock.calls[0]![0] as FormData;
    expect(form.get("name")).toBe("Summer sale");
    expect(form.get("path")).toBe("summer-sale");
    expect(form.get("data")).toBe(JSON.stringify({ promo: "SUMMER20" }));
    expect(screen.getAllByText("segdemo.sqd.link/summer-sale")).toHaveLength(2);
    expect(screen.getByTestId("qr")).toHaveAttribute(
      "data-value",
      "https://segdemo.sqd.link/summer-sale"
    );
    expect(
      screen.getByText("Waiting for someone to open it")
    ).toBeInTheDocument();
    expect(screen.getByText("Troubleshoot")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Send to my phone" })
    ).toHaveAttribute("href", expect.stringContaining("mailto:me@segments.io"));
  });

  it("warns that test builds don't open production links", () => {
    renderTry();
    expect(
      screen.getByText(/Test builds don't open production links/)
    ).toHaveTextContent("Use a build with useTestEnvironment off.");
  });

  it("never blocks Finish", () => {
    const { onFinish } = renderTry();
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    expect(onFinish).toHaveBeenCalled();
  });

  it("says it opened the app once the link was opened", () => {
    localStorage.setItem(
      "grovs.setup.firstLink.i1",
      JSON.stringify({
        id: "7",
        name: "Summer sale",
        path: "summer-sale",
        url: "https://segdemo.sqd.link/summer-sale",
        data: { promo: "SUMMER20" },
      })
    );
    m.opened = {
      opened_at: new Date().toISOString(),
      platform: "ios",
      model: "iPhone 15",
      app_version: "2.3.0",
    };
    renderTry();
    expect(screen.getByText("It opened Segments Demo")).toBeInTheDocument();
    expect(screen.getByText("iPhone 15 · iOS · just now")).toBeInTheDocument();
    expect(
      screen.getByText("Recorded as your first link open")
    ).toBeInTheDocument();
  });

  it("describes an open without a model", () => {
    expect(
      describeOpen({
        opened_at: new Date().toISOString(),
        platform: "android",
        model: null,
        app_version: null,
      })
    ).toBe("Android · just now");
  });
});

describe("DoneStep", () => {
  it("summarises the setup with what's left to connect", () => {
    const onEdit = vi.fn();
    const onNavigate = vi.fn();
    render(
      <DoneStep
        instance={instance}
        data={makeData({
          signals: signals({
            domainMarked: true,
            appConnected: true,
            fallbackSet: true,
            hasLinks: true,
          }),
          redirectConfig: {
            default_fallback: "https://segments.io",
            show_preview_android: false,
            show_preview_ios: false,
            ios: { phone: { enabled: true, appstore: true } },
          },
          platforms: {
            ios: { registered: true, seen: true, config: iosConfig() },
          },
        })}
        onEdit={onEdit}
        onNavigate={onNavigate}
      />
    );
    expect(
      screen.getByRole("heading", { name: "Segments Demo is set up" })
    ).toBeInTheDocument();
    expect(screen.getAllByText("segdemo.sqd.link").length).toBeGreaterThan(0);
    expect(screen.getByText("io.segments.demo")).toBeInTheDocument();
    expect(
      screen.getByText("App, else store · segments.io")
    ).toBeInTheDocument();
    expect(screen.getByText("Not connected")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    expect(onEdit).toHaveBeenCalledWith("app", "android");
    fireEvent.click(screen.getByRole("button", { name: /Invite your team/ }));
    expect(onNavigate).toHaveBeenCalledWith("/settings/team");
    fireEvent.click(screen.getByRole("button", { name: "Go to Home" }));
    expect(onNavigate).toHaveBeenCalledWith("/dashboard");
  });
});
