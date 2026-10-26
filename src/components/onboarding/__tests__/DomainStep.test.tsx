import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { instance, makeData, mutation } from "./fixtures";

const m = vi.hoisted(() => ({
  scaleUp: [] as Record<string, unknown>[],
  prod: { id: "d1", subdomain: "segdemo", domain: "sqd.link" },
  test: { id: "d2", subdomain: "segdemo", domain: "test-sqd.link" },
}));

vi.mock("@/hooks/queries/useConfigurationQueries", () => ({
  useDomainConfigQuery: vi.fn((id: string) => ({
    data: id === "p1" ? m.prod : m.test,
  })),
  useDomainDefaultsQuery: vi.fn(() => ({
    data: {
      generic_title: "grovs",
      generic_subtitle: "Dynamic links",
      generic_image_url: "https://cdn/placeholder.jpg",
    },
  })),
  useCustomDomainEnvelopeQuery: vi.fn(() => ({
    isLoading: false,
    data: {
      custom_domain: {
        hostname: "links.segments.io",
        purpose: "primary",
        status: "pending",
        ssl_status: null,
        verification_errors: null,
        source: "saas",
        cname_target: "proxy.sqd.link",
        ssl_validation_txt_records: [],
      },
    },
  })),
  useCustomDomainPreflightQuery: vi.fn(() => ({
    data: { hostname: "links.segments.io", cname_matches: false },
    dataUpdatedAt: Date.now(),
  })),
}));

const muts = vi.hoisted(() => ({
  setSubdomain: null as unknown as ReturnType<
    typeof import("./fixtures").mutation
  >,
  verify: null as unknown as ReturnType<typeof import("./fixtures").mutation>,
  addDomain: null as unknown as ReturnType<
    typeof import("./fixtures").mutation
  >,
  migrate: null as unknown as ReturnType<typeof import("./fixtures").mutation>,
}));

vi.mock("@/hooks/mutations/useConfigurationMutations", () => ({
  useSetSubdomainMutation: () => muts.setSubdomain,
  useVerifySubdomainMutation: () => muts.verify,
  useAddCustomDomainMutation: () => muts.addDomain,
}));
vi.mock("@/hooks/mutations/useMigrationMutations", () => ({
  useCreateMigrationMutation: () => muts.migrate,
}));
vi.mock("@/hooks/queries/useMigrationQueries", () => ({
  useMigrationSourceQuery: () => ({ data: null }),
}));
vi.mock("@/hooks/queries/usePaymentsQueries", () => ({
  useSubscriptionQuery: () => ({ data: { subscription: null } }),
}));
vi.mock("@/components/settings/ScaleUpDialog", () => ({
  default: (props: Record<string, unknown>) => {
    m.scaleUp.push(props);
    return props.open ? <div data-testid="checkout" /> : null;
  },
}));
vi.mock("@/lib/Notifications", () => ({
  showGenericError: vi.fn(),
  showErrorNotification: vi.fn(),
}));

import { DomainStep } from "../steps/domain/DomainStep";

const renderStep = (data = makeData()) => {
  const onDone = vi.fn();
  const markDone = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DomainStep
        instance={instance}
        data={data}
        onDone={onDone}
        markDone={markDone}
      />
    </QueryClientProvider>
  );
  return { onDone, markDone };
};

const settle = () => act(() => new Promise((r) => setTimeout(r, 400)));

beforeEach(() => {
  m.scaleUp = [];
  muts.setSubdomain = mutation();
  muts.verify = mutation(() => Promise.resolve({ data: { available: true } }));
  muts.addDomain = mutation();
  muts.migrate = mutation();
});

describe("DomainStep", () => {
  it("starts on the Grovs domain with the current name checked", async () => {
    renderStep();
    expect(screen.getByRole("radio", { name: /Grovs domain/ })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByLabelText("Subdomain")).toHaveValue("segdemo");
    await settle();
    expect(screen.getByRole("img", { name: "Available" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
    expect(screen.getByTestId("link-card")).toHaveTextContent(
      "segdemo.sqd.link"
    );
  });

  it("blocks a taken or short name", async () => {
    muts.verify = mutation(() =>
      Promise.resolve({ data: { available: false } })
    );
    renderStep();
    fireEvent.change(screen.getByLabelText("Subdomain"), {
      target: { value: "taken1" },
    });
    await settle();
    expect(screen.getByRole("alert")).toHaveTextContent("taken");
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Subdomain"), {
      target: { value: "abc" },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("at least 5");
  });

  it("says when the name couldn't be checked", async () => {
    muts.verify = mutation(() => Promise.reject(new Error("offline")));
    renderStep();
    fireEvent.change(screen.getByLabelText("Subdomain"), {
      target: { value: "newname" },
    });
    await settle();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't check this name. Try again."
    );
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("saves a new name on production and test, then moves on", async () => {
    const { onDone, markDone } = renderStep();
    fireEvent.click(screen.getByRole("button", { name: "segmentsdemo" }));
    await settle();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    });
    expect(muts.setSubdomain.mutateAsync).toHaveBeenCalledTimes(2);
    const form = muts.setSubdomain.mutateAsync.mock.calls[0]![0] as FormData;
    expect(form.get("subdomain")).toBe("segmentsdemo");
    expect(form.has("generic_image_url")).toBe(false);
    expect(markDone).toHaveBeenCalled();
    expect(onDone).toHaveBeenCalled();
  });

  it("shows the plans and opens checkout for your own domain on a free plan", async () => {
    renderStep();
    fireEvent.click(screen.getByRole("radio", { name: /Your own domain/ }));
    expect(screen.getByRole("radio", { name: /Growth 250K/ })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByText("Talk to sales")).toBeInTheDocument();
    const pay = screen.getByRole("button", { name: "Continue to payment" });
    expect(pay).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Your domain"), {
      target: { value: "links.segments.io" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
    fireEvent.click(screen.getByRole("radio", { name: /Scale 1M/ }));
    expect(screen.getByText("Scale 1M · $1,199 / month")).toBeInTheDocument();
    fireEvent.click(pay);
    expect(screen.getByTestId("checkout")).toBeInTheDocument();
    expect(m.scaleUp.filter((p) => p.initialChoice).at(-1)).toMatchObject({
      open: true,
      initialChoice: { plan: "scale_1m", interval: "monthly" },
    });
  });

  it("explains a root domain and offers a subdomain of it", async () => {
    renderStep();
    fireEvent.click(screen.getByRole("radio", { name: /Your own domain/ }));
    fireEvent.change(screen.getByLabelText("Your domain"), {
      target: { value: "razvan.com" },
    });
    expect(
      await screen.findByText(/razvan\.com is a root domain/)
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Use links.razvan.com" })
    );
    expect(screen.getByLabelText("Your domain")).toHaveValue(
      "links.razvan.com"
    );
    expect(
      screen.getByRole("button", { name: "Continue to payment" })
    ).toBeEnabled();
  });

  it("adds the domain after paying and shows the DNS records", async () => {
    renderStep();
    fireEvent.click(screen.getByRole("radio", { name: /Your own domain/ }));
    fireEvent.change(screen.getByLabelText("Your domain"), {
      target: { value: "links.segments.io" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Continue to payment" })
    );
    const checkout = m.scaleUp.find((p) => p.open)!;
    await act(async () => {
      (checkout.onPurchased as () => void)();
    });
    expect(muts.addDomain.mutateAsync).toHaveBeenCalledWith({
      hostname: "links.segments.io",
      purpose: "primary",
    });
    expect(
      screen.getByRole("heading", { name: "Point links.segments.io to Grovs" })
    ).toBeInTheDocument();
    expect(screen.getByText("proxy.sqd.link")).toBeInTheDocument();
    expect(
      screen.getByText("Waiting for the CNAME record")
    ).toBeInTheDocument();
  });

  it("skips payment when the plan already covers it", async () => {
    renderStep(makeData({ hasPaidPlan: true }));
    fireEvent.click(screen.getByRole("radio", { name: /Your own domain/ }));
    expect(screen.queryByRole("radio", { name: /Growth 250K/ })).toBeNull();
    fireEvent.change(screen.getByLabelText("Your domain"), {
      target: { value: "links.segments.io" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    });
    expect(muts.addDomain.mutateAsync).toHaveBeenCalled();
    expect(screen.getByText("Link domain · last part")).toBeInTheDocument();
  });

  it("opens straight on the DNS records when a domain is already being set up", () => {
    const { onDone, markDone } = renderStep(
      makeData({
        primaryDomain: {
          hostname: "links.segments.io",
        } as never,
      })
    );
    expect(
      screen.getByText("You can continue now; we'll keep checking.")
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(markDone).toHaveBeenCalled();
    expect(onDone).toHaveBeenCalled();
  });

  it("asks for a paid plan before bringing old links on a free plan", () => {
    renderStep();
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Also bring my old links/ })
    );
    expect(screen.getByText(/needs a paid plan/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View plans" }));
    expect(m.scaleUp.filter((p) => !p.initialChoice).at(-1)).toMatchObject({
      open: true,
    });
  });

  it("collects the migration fields and starts it with the domain", async () => {
    const { onDone } = renderStep(makeData({ hasPaidPlan: true }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Also bring my old links/ })
    );
    expect(screen.getByText("What happens to an old link")).toBeInTheDocument();
    await settle();
    const next = screen.getByRole("button", { name: "Continue" });
    expect(next).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Your current link domain"), {
      target: { value: "links.segments.io" },
    });
    expect(screen.getByRole("radio", { name: /Branch does/ })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Branch key"), {
      target: { value: "key_live_abc123" },
    });
    expect(screen.getByText(/applinks:links.segments.io/)).toBeInTheDocument();
    expect(next).toBeEnabled();
    await act(async () => {
      fireEvent.click(next);
    });
    expect(muts.migrate.mutateAsync).toHaveBeenCalledWith({
      hostname: "links.segments.io",
      provider: "branch",
      credentials: { branch_key: "key_live_abc123" },
    });
    expect(onDone).toHaveBeenCalled();
  });

  it("asks before renaming a domain that already has links", async () => {
    renderStep(
      makeData({ signals: { ...makeData().signals, hasLinks: true } })
    );
    fireEvent.click(screen.getByRole("button", { name: "segmentsdemo" }));
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Change your link domain?")).toBeInTheDocument();
    expect(muts.setSubdomain.mutateAsync).not.toHaveBeenCalled();
  });
});
