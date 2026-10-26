import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterEach,
} from "vitest";
import PlanSection from "../settings/PlanSection";
import {
  useSubscriptionQuery,
  useMauQuery,
} from "@/hooks/queries/usePaymentsQueries";
import { showSuccessNotification } from "@/lib/Notifications";

const cancelMutateAsync = vi.fn();
const resumeMutateAsync = vi.fn();
const refetch = vi.fn();
let resumeIsPending = false;
let cancelIsPending = false;
const selection = { instance: { id: "inst_1", name: "Acme" } };

vi.mock("@/context/useProjectSelection", () => ({
  useProjectSelection: () => ({ selectedInstance: selection.instance }),
}));
vi.mock("@/hooks/queries/usePaymentsQueries", () => ({
  useSubscriptionQuery: vi.fn(),
  useMauQuery: vi.fn(),
}));
vi.mock("@/hooks/mutations/usePaymentsMutations", () => ({
  useCreateSubscriptionMutation: () => ({ mutateAsync: vi.fn() }),
  useCancelSubscriptionMutation: () => ({
    mutateAsync: cancelMutateAsync,
    isPending: cancelIsPending,
  }),
  useResumeSubscriptionMutation: () => ({
    mutateAsync: resumeMutateAsync,
    isPending: resumeIsPending,
  }),
}));
vi.mock("@/lib/Notifications", () => ({
  showSuccessNotification: vi.fn(),
  showErrorNotification: vi.fn(),
}));
vi.mock("@/lib/config", () => ({
  config: {
    pricingUrl: "https://example.com/pricing",
    salesUrl: "https://example.com/sales",
    supportEmail: "support@example.com",
  },
}));

// 2027-10-20T12:00:00Z
const PERIOD_END = 1824033600;

const flat = {
  type: "stripe",
  plan: "growth_250k",
  interval: "yearly",
  mau_cap: 250000,
  maus: 100000,
  stripe_subscription: {
    current_period_start: 1792540800,
    current_period_end: PERIOD_END,
  },
  amount_cents: 250000,
  cancels_at: null,
};

const legacy = {
  type: "stripe",
  maus: 42,
  quantity_for_current_billing_cycle: 0,
  amount_cents: 0,
  stripe_subscription: {
    current_period_start: 1700000000,
    current_period_end: 1731536000,
  },
};

function mockSubscription(subscription: object | null) {
  refetch.mockResolvedValue({ data: { subscription, isEnterprise: false } });
  vi.mocked(useSubscriptionQuery).mockReturnValue({
    data: { subscription, isEnterprise: false },
    isLoading: false,
    isFetched: true,
    refetch,
  } as never);
}

function renderWith(subscription: object | null) {
  mockSubscription(subscription);
  vi.mocked(useMauQuery).mockReturnValue({
    data: { current_quantity: 5, total_available: 10000 },
  } as never);
  const client = new QueryClient();
  const ui = () => (
    <QueryClientProvider client={client}>
      <PlanSection />
    </QueryClientProvider>
  );
  const result = render(ui());
  return {
    ...result,
    serverReturns: (next: object | null) => {
      mockSubscription(next);
      result.rerender(ui());
    },
  };
}

async function openMenu() {
  await userEvent.click(screen.getByRole("button", { name: "More options" }));
}

// Radix popper content needs ResizeObserver, which jsdom doesn't ship.
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (
      globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }
    ).ResizeObserver = ResizeObserverStub;
  }
});

beforeEach(() => {
  cancelMutateAsync.mockReset().mockResolvedValue({});
  resumeMutateAsync.mockReset().mockResolvedValue({});
  vi.mocked(showSuccessNotification).mockReset();
  refetch.mockClear();
  resumeIsPending = false;
  cancelIsPending = false;
  selection.instance = { id: "inst_1", name: "Acme" };
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PlanSection flat plans", () => {
  it("shows plan name, band, renewal and MAU against the cap in en-US", () => {
    renderWith(flat);
    expect(screen.getByText("Growth")).toBeInTheDocument();
    expect(screen.getByText("· up to 250K MAU")).toBeInTheDocument();
    expect(
      screen.getByText("Billed yearly · renews 20 Oct 2027")
    ).toBeInTheDocument();
    expect(screen.getByText("100,000")).toBeInTheDocument();
    expect(screen.getByText("/ 250,000")).toBeInTheDocument();
    expect(screen.getByText("150,000 left this month")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /What counts as a MAU/ })
    ).toBeInTheDocument();
  });

  it("drops the crown icon tile and the old actions", () => {
    const { container } = renderWith(flat);
    expect(container.querySelector(".lucide-crown")).toBeNull();
    expect(
      screen.queryByRole("link", { name: /contact us/ })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cancel Plan" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Manage billing/ })
    ).toBeInTheDocument();
  });

  it("shows the facts row", () => {
    renderWith(flat);
    expect(screen.getByText("Next invoice")).toBeInTheDocument();
    expect(screen.getByText("$2,500.00")).toBeInTheDocument();
    expect(screen.getByText("on 20 Oct 2027")).toBeInTheDocument();
    expect(screen.getByText("Billing period")).toBeInTheDocument();
    expect(screen.getByText("Yearly")).toBeInTheDocument();
    expect(screen.getByText("Payment")).toBeInTheDocument();
    expect(screen.getByText("Card on file")).toBeInTheDocument();
    expect(screen.queryByText("MAUs this month")).not.toBeInTheDocument();
  });

  it("says Billed monthly for monthly plans", () => {
    renderWith({ ...flat, interval: "monthly" });
    expect(
      screen.getByText("Billed monthly · renews 20 Oct 2027")
    ).toBeInTheDocument();
    expect(screen.getByText("Monthly")).toBeInTheDocument();
  });

  it("menu Change plan is a mailto to support naming the project", async () => {
    renderWith(flat);
    await openMenu();
    const item = screen.getByRole("menuitem", { name: /Change plan/ });
    const href = item.getAttribute("href") ?? "";
    expect(href.startsWith("mailto:support@example.com?")).toBe(true);
    const params = new URLSearchParams(href.split("?")[1]);
    expect(params.get("subject")).toBe("Change plan for project Acme");
    expect(params.get("body")).toContain("Growth · up to 250K MAU");
    expect(
      screen.getByRole("menuitem", { name: /Invoices/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Cancel plan/ })
    ).toHaveTextContent("Keeps access until 20 Oct 2027");
  });

  it("Cancel plan opens a confirmation; Keep plan closes it", async () => {
    renderWith(flat);
    await openMenu();
    await userEvent.click(
      screen.getByRole("menuitem", { name: /Cancel plan/ })
    );
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Cancel Growth?");
    expect(dialog).toHaveTextContent(
      "You keep access until 20 Oct 2027. After that the project moves to Free"
    );
    await userEvent.click(screen.getByRole("button", { name: "Keep plan" }));
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    );
    expect(cancelMutateAsync).not.toHaveBeenCalled();
  });

  it("confirming cancels and toasts the end date from the refreshed plan", async () => {
    renderWith(flat);
    refetch.mockResolvedValue({
      data: {
        subscription: { ...flat, cancels_at: "2027-10-20T12:00:00Z" },
        isEnterprise: false,
      },
    });
    await openMenu();
    await userEvent.click(
      screen.getByRole("menuitem", { name: /Cancel plan/ })
    );
    await screen.findByRole("alertdialog");
    await userEvent.click(screen.getByRole("button", { name: "Cancel plan" }));
    expect(cancelMutateAsync).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(showSuccessNotification).toHaveBeenCalledWith(
        "Your plan ends on 20 Oct 2027."
      )
    );
    expect(refetch).toHaveBeenCalledWith({ cancelRefetch: false });
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("falls back to the period end when the refresh has no cancels_at", async () => {
    renderWith(flat);
    await openMenu();
    await userEvent.click(
      screen.getByRole("menuitem", { name: /Cancel plan/ })
    );
    await screen.findByRole("alertdialog");
    await userEvent.click(screen.getByRole("button", { name: "Cancel plan" }));
    await waitFor(() =>
      expect(showSuccessNotification).toHaveBeenCalledWith(
        "Your plan ends on 20 Oct 2027."
      )
    );
  });

  it("shows Cancelling… only while the cancel request is in flight", async () => {
    cancelIsPending = true;
    renderWith(flat);
    expect(
      screen.getByText("Cancelling… your plan ends on 20 Oct 2027")
    ).toBeInTheDocument();
    await openMenu();
    expect(
      screen.getByRole("menuitem", { name: /Cancel plan/ })
    ).toHaveAttribute("data-disabled");
  });

  it("shows no pending strip once the cancel has resolved", () => {
    renderWith(flat);
    expect(screen.queryByText(/Cancelling…/)).not.toBeInTheDocument();
  });

  it("while cancelling shows ends date, no-invoice fact, and Resume plan", async () => {
    renderWith({ ...flat, cancels_at: "2027-10-20T12:00:00Z" });
    expect(
      screen.getByText("Billed yearly · ends 20 Oct 2027")
    ).not.toHaveClass("text-destructive");
    expect(
      screen.getByText(
        "This plan ends on 20 Oct 2027. After that the project moves to Free (up to 10K monthly active users)."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("None")).toBeInTheDocument();
    expect(screen.getByText("Plan ends 20 Oct 2027")).toBeInTheDocument();
    await openMenu();
    expect(
      screen.queryByRole("menuitem", { name: /Cancel plan/ })
    ).not.toBeInTheDocument();
    const resume = screen.getByRole("menuitem", { name: /Resume plan/ });
    expect(resume).toHaveTextContent("Keep Growth after 20 Oct 2027");
    await userEvent.click(resume);
    expect(resumeMutateAsync).toHaveBeenCalledTimes(1);
  });

  it("Next invoice falls back to the list price when amount is unknown", () => {
    renderWith({ ...flat, amount_cents: null });
    expect(screen.getByText("$2,500.00")).toBeInTheDocument();
    expect(screen.getByText("on 20 Oct 2027")).toBeInTheDocument();
    expect(screen.queryByText("None")).not.toBeInTheDocument();
  });

  it("Next invoice falls back to the monthly list price for monthly plans", () => {
    renderWith({ ...flat, interval: "monthly", amount_cents: null });
    expect(screen.getByText("$249.00")).toBeInTheDocument();
  });
});

describe("PlanSection cancelling notice", () => {
  const cancelling = { ...flat, cancels_at: "2027-10-20T12:00:00Z" };

  it("resume toasts the renewal date right after the request resolves", async () => {
    renderWith(cancelling);
    refetch.mockResolvedValue({
      data: { subscription: flat, isEnterprise: false },
    });
    await userEvent.click(screen.getByRole("button", { name: "Resume plan" }));
    expect(resumeMutateAsync).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(showSuccessNotification).toHaveBeenCalledWith(
        "Your plan will renew on 20 Oct 2027."
      )
    );
    expect(refetch).toHaveBeenCalledWith({ cancelRefetch: false });
  });

  it("shows Resuming… instead of the Resume button while in flight", async () => {
    resumeIsPending = true;
    renderWith(cancelling);
    expect(screen.getByText("Resuming your plan…")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Resume plan" })
    ).not.toBeInTheDocument();
    await openMenu();
    expect(
      screen.getByRole("menuitem", { name: /Resume plan/ })
    ).toHaveAttribute("data-disabled");
  });

  it("double-clicking Resume plan sends one request", async () => {
    resumeMutateAsync.mockReturnValue(new Promise(() => {}));
    renderWith(cancelling);
    const resume = screen.getByRole("button", { name: "Resume plan" });
    fireEvent.click(resume);
    fireEvent.click(resume);
    await userEvent.dblClick(resume);
    expect(resumeMutateAsync).toHaveBeenCalledTimes(1);
  });

  it("hides the strip Resume while a cancel is in flight", () => {
    cancelIsPending = true;
    renderWith(cancelling);
    expect(
      screen.queryByRole("button", { name: "Resume plan" })
    ).not.toBeInTheDocument();
  });
});

describe("PlanSection legacy Scale Up", () => {
  it("keeps the legacy layout without an icon tile", () => {
    const { container } = renderWith(legacy);
    expect(container.querySelector(".lucide-crown")).toBeNull();
    expect(screen.getByText("Scale Up")).toBeInTheDocument();
    expect(screen.getByText("Billed MAUs")).toBeInTheDocument();
  });

  it("cancel goes through the confirmation", async () => {
    renderWith(legacy);
    fireEvent.click(screen.getByRole("button", { name: "Cancel Plan" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Cancel Scale Up?");
    expect(dialog).toHaveTextContent("Billing stops now");
    expect(cancelMutateAsync).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Cancel plan" }));
    expect(cancelMutateAsync).toHaveBeenCalledTimes(1);
  });
});

describe("PlanSection payment issue", () => {
  it("shows a payment issue state with only Manage Billing", () => {
    renderWith({
      type: "stripe",
      payment_issue: true,
      status: "past_due",
      plan: "growth_250k",
    });
    expect(screen.getByText("Payment issue")).toBeInTheDocument();
    expect(
      screen.getByText("Update your payment method to restore your plan.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Manage Billing/ })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Upgrade" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Enterprise" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cancel Plan" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "More options" })
    ).not.toBeInTheDocument();
  });
});

describe("PlanSection upgrade", () => {
  it("Free card has no icon tile", () => {
    const { container } = renderWith(null);
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(container.querySelector(".lucide-zap")).toBeNull();
  });

  it("opens the in-app upgrade dialog from Upgrade", () => {
    renderWith(null);
    fireEvent.click(screen.getByRole("button", { name: "Upgrade" }));
    expect(
      screen.getByRole("button", { name: "Continue to payment" })
    ).toBeInTheDocument();
  });
});
