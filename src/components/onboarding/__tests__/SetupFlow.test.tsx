import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { instance, makeData, mutation, signals } from "./fixtures";
import type { SetupData } from "../useSetupData";

const m = vi.hoisted(() => ({
  data: null as unknown as SetupData,
  search: "",
  push: vi.fn(),
  complete: null as unknown as ReturnType<typeof import("./fixtures").mutation>,
  dismiss: null as unknown as ReturnType<typeof import("./fixtures").mutation>,
  instance: null as unknown,
  setupArg: undefined as unknown,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: m.push }),
  useSearchParams: () => new URLSearchParams(m.search),
}));
vi.mock("@/context/useProjectSelection", () => ({
  useProjectSelection: () => ({
    selectedInstance: m.instance,
    setSelectedInstance: vi.fn(),
  }),
}));
vi.mock("../useSetupData", () => ({
  useSetupData: (inst: unknown) => {
    m.setupArg = inst;
    return m.data;
  },
}));
vi.mock("@/hooks/mutations/useInstanceMutations", () => ({
  useCompleteSetupStepMutation: () => m.complete,
  useDismissGetStartedMutation: () => m.dismiss,
}));
vi.mock("../steps/domain/DomainStep", () => ({
  DomainStep: ({
    onDone,
    markDone,
  }: {
    onDone: () => void;
    markDone: () => void;
  }) => (
    <button
      onClick={() => {
        markDone();
        onDone();
      }}
    >
      step:domain
    </button>
  ),
}));
vi.mock("../steps/connect/ConnectStep", () => ({
  ConnectStep: ({ platform }: { platform: string }) => (
    <div>step:app:{platform}</div>
  ),
}));
vi.mock("../steps/links/LinksStep", () => ({
  LinksStep: ({ onNext }: { onNext: () => void }) => (
    <button onClick={onNext}>step:links</button>
  ),
}));
vi.mock("../steps/links/SharePreviewStep", () => ({
  SharePreviewStep: () => <div>step:share</div>,
}));
vi.mock("../steps/TryStep", () => ({ TryStep: () => <div>step:try</div> }));
vi.mock("../steps/DoneStep", () => ({ DoneStep: () => <div>step:done</div> }));

import { SetupFlow } from "../SetupFlow";
import { SetupSidebarEntry } from "@/components/layout/SetupSidebarEntry";
import { StepPage } from "../primitives";
import { writeSearchParams } from "@/lib/searchParamsUrl";

vi.mock("@/components/ui/sidebar", () => ({
  SidebarMenu: ({ children }: { children: React.ReactNode }) => (
    <ul>{children}</ul>
  ),
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => (
    <li>{children}</li>
  ),
  SidebarMenuButton: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick: () => void;
  }) => <button onClick={onClick}>{children}</button>,
  SidebarMenuAction: ({
    children,
    onClick,
    ...rest
  }: {
    children: React.ReactNode;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      aria-label={(rest as { "aria-label": string })["aria-label"]}
    >
      {children}
    </button>
  ),
}));

beforeEach(() => {
  m.search = "";
  m.push.mockReset();
  m.complete = mutation();
  m.dismiss = mutation(() =>
    Promise.resolve({
      data: { instance: { ...instance, get_started_dismissed: true } },
    })
  );
  m.instance = instance;
  m.data = makeData();
  window.history.replaceState(
    null,
    "",
    "/setup?instance_id=i1&env_type=Production"
  );
});

describe("SetupFlow", () => {
  it("resumes a fresh project at the domain", () => {
    render(<SetupFlow />);
    expect(screen.getByText("step:domain")).toBeInTheDocument();
    expect(screen.getByText("Project setup")).toBeInTheDocument();
    expect(window.location.search).toContain("step=domain");
  });

  it("resumes at the first step without data", () => {
    m.data = makeData({
      signals: signals({ domainMarked: true, appConnected: true }),
    });
    render(<SetupFlow />);
    expect(screen.getByText("step:links")).toBeInTheDocument();
  });

  it("opens the done screen when everything is saved", () => {
    m.data = makeData({
      signals: signals({
        appConnected: true,
        fallbackSet: true,
        hasLinks: true,
      }),
    });
    render(<SetupFlow />);
    expect(screen.getByText("step:done")).toBeInTheDocument();
  });

  it("waits for the data before choosing", () => {
    m.data = makeData({ loading: true });
    render(<SetupFlow />);
    expect(screen.queryByText(/^step:/)).toBeNull();
  });

  it("honours a deep link to a step and platform", () => {
    m.search = "step=app&platform=android";
    render(<SetupFlow />);
    expect(screen.getByText("step:app:android")).toBeInTheDocument();
  });

  it("records the chosen domain and moves on", () => {
    render(<SetupFlow />);
    fireEvent.click(screen.getByText("step:domain"));
    expect(m.complete.mutate).toHaveBeenCalledWith({
      category: "onboarding",
      stepIdentifier: "link_domain",
    });
    expect(screen.getByText(/^step:app/)).toBeInTheDocument();
  });

  it("records app_connected once the SDK is first seen", () => {
    m.data = makeData({ signals: signals({ appConnected: true }) });
    const { rerender } = render(<SetupFlow />);
    rerender(<SetupFlow />);
    expect(m.complete.mutate).toHaveBeenCalledTimes(1);
    expect(m.complete.mutate).toHaveBeenCalledWith({
      category: "onboarding",
      stepIdentifier: "app_connected",
    });
  });

  it.each([
    ["not seen yet", { appConnected: false }],
    ["already recorded", { appConnected: true, appMarked: true }],
  ])("does not record app_connected when %s", (_, over) => {
    m.data = makeData({ signals: signals(over) });
    render(<SetupFlow />);
    expect(m.complete.mutate).not.toHaveBeenCalled();
  });

  it("goes from Links to the share preview screen", () => {
    m.search = "step=links";
    render(<SetupFlow />);
    fireEvent.click(screen.getByText("step:links"));
    expect(screen.getByText("step:share")).toBeInTheDocument();
  });

  it("jumps between steps from the tracker and closes to Home", () => {
    render(<SetupFlow />);
    fireEvent.click(screen.getByRole("button", { name: /Try it/ }));
    expect(screen.getByText("step:try")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close setup" }));
    expect(m.push).toHaveBeenCalledWith(
      "/dashboard?instance_id=i1&env_type=Production"
    );
  });

  it("marks finished steps in the tracker", () => {
    m.search = "step=links";
    m.data = makeData({
      signals: signals({ domainMarked: true, appConnected: true }),
    });
    render(<SetupFlow />);
    expect(screen.getByRole("button", { name: /Links/ })).toHaveAttribute(
      "aria-current",
      "step"
    );
  });
});

describe("SetupSidebarEntry", () => {
  it("shows progress until the setup is complete", () => {
    m.data = makeData({ signals: signals({ domainMarked: true }) });
    window.history.replaceState(
      null,
      "",
      "/dashboard?env_type=test&step=links"
    );
    const { rerender } = render(<SetupSidebarEntry />);
    expect(screen.getByText("Finish setup")).toBeInTheDocument();
    expect(screen.getByText("1/4")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Finish setup"));
    expect(m.push).toHaveBeenCalledWith("/setup?env_type=test&instance_id=i1");
    m.data = makeData({
      signals: signals({
        appConnected: true,
        fallbackSet: true,
        hasLinks: true,
      }),
    });
    rerender(<SetupSidebarEntry />);
    expect(screen.queryByText("Finish setup")).toBeNull();
  });

  it("hides once dismissed", async () => {
    render(<SetupSidebarEntry />);
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Hide setup" }))
    );
    expect(m.dismiss.mutateAsync).toHaveBeenCalledWith({ id: "i1" });
    m.instance = { ...instance, get_started_dismissed: true };
    render(<SetupSidebarEntry />);
    expect(screen.getAllByText("Finish setup")).toHaveLength(1);
    // A dismissed setup runs no setup queries.
    expect(m.setupArg).toBeNull();
  });
});

describe("layout", () => {
  it("drops the preview column at phone width", () => {
    render(<StepPage left={<p>left</p>} right={<p>right</p>} footer={null} />);
    expect(screen.getByText("right").parentElement).toHaveClass(
      "hidden",
      "lg:flex"
    );
  });
});

describe("writeSearchParams", () => {
  it("leaves history alone when nothing changes", () => {
    window.history.replaceState(null, "", "/dashboard?instance_id=1");
    const spy = vi.spyOn(window.history, "replaceState");
    writeSearchParams({ instance_id: 1 });
    expect(spy).not.toHaveBeenCalled();
    writeSearchParams({ instance_id: 2 });
    expect(spy).toHaveBeenCalledWith(null, "", "/dashboard?instance_id=2");
    spy.mockRestore();
  });
});
