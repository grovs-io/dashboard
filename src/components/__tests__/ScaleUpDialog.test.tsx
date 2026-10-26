import { render, screen, fireEvent, act } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
  QueryObserver,
} from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterEach,
} from "vitest";
import { ApiError } from "@/lib/ApiError";
import { useSubscriptionQuery } from "@/hooks/queries/usePaymentsQueries";
import { showErrorNotification } from "@/lib/Notifications";
import { trackEvent } from "@/analytics";
import ScaleUpDialog from "../settings/ScaleUpDialog";

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  push: vi.fn(),
  stripe: { value: Promise.resolve({}) as Promise<unknown> | null },
  checkoutState: { value: { type: "loading" } as unknown },
  confirm: vi.fn(),
  validateElements: vi.fn(),
  updateTaxIdInfo: vi.fn(),
  providerOptions: [] as unknown[],
  getStripe: vi.fn(),
}));

vi.mock("@/lib/config", () => ({
  config: {
    pricingUrl: "https://example.com/pricing",
    salesUrl: "https://example.com/sales",
  },
}));
vi.mock("@/context/useProjectSelection", () => ({
  useProjectSelection: () => ({ selectedInstance: { id: "inst_1" } }),
}));
vi.mock("@/context/useUserContext", () => ({
  useUserContext: () => ({ user: { email: "dev@example.com" } }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams("instance_id=inst_1"),
}));
vi.mock("@/hooks/mutations/usePaymentsMutations", () => ({
  useCreateSubscriptionMutation: () => ({
    mutateAsync: mocks.mutateAsync,
    isPending: mocks.isPending,
  }),
}));
vi.mock("@/hooks/queries/usePaymentsQueries", () => ({
  useSubscriptionQuery: vi.fn(),
}));
vi.mock("@/lib/Notifications", () => ({ showErrorNotification: vi.fn() }));
vi.mock("@/analytics", () => ({
  trackEvent: vi.fn(),
  EVENTS: { PURCHASE: "purchase" },
}));
vi.mock("@/lib/stripe", () => ({
  get hasStripeKey() {
    return mocks.stripe.value !== null;
  },
  getStripe: () => mocks.getStripe(),
}));
vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));
vi.mock("@stripe/react-stripe-js/checkout", () => ({
  CheckoutElementsProvider: ({
    options,
    children,
  }: {
    options: { clientSecret: string };
    children: ReactNode;
  }) => {
    mocks.providerOptions.push(options);
    return (
      <div
        data-testid="stripe-provider"
        data-client-secret={options.clientSecret}
      >
        {children}
      </div>
    );
  },
  useCheckoutElements: () => mocks.checkoutState.value,
  PaymentElement: ({ onChange }: { onChange: () => void }) => (
    <div data-testid="payment-element">
      <button type="button" onClick={onChange}>
        Edit card
      </button>
    </div>
  ),
  BillingAddressElement: ({ onChange }: { onChange: () => void }) => (
    <div data-testid="billing-address-element">
      <button type="button" onClick={onChange}>
        Edit address
      </button>
    </div>
  ),
  TaxIdElement: ({ options }: { options: object }) => (
    <div data-testid="tax-id-element" data-options={JSON.stringify(options)} />
  ),
}));

const readyCheckout = (overrides: object = {}) => ({
  type: "success",
  checkout: {
    email: "dev@example.com",
    taxIdInfo: null,
    canConfirm: true,
    validateElements: mocks.validateElements,
    confirm: mocks.confirm,
    updateTaxIdInfo: mocks.updateTaxIdInfo,
    ...overrides,
  },
});

const mockedSubscription = vi.mocked(useSubscriptionQuery);

const activeSub = (overrides: object = {}) => ({
  type: "stripe",
  plan: "growth_250k",
  interval: "yearly",
  mau_cap: 250000,
  details: { active: true, paused: false },
  stripe_subscription: {
    current_period_start: 1792454400,
    current_period_end: 1823990400,
  },
  latest_invoice: {
    number: "4F2A1C-0001",
    invoice_pdf: "https://pay.stripe.com/invoice/pdf",
    hosted_invoice_url: "https://invoice.stripe.com/i/1",
    amount_paid: 250000,
    status: "paid",
    paid_at: 1792454400,
  },
  billed_to: {
    name: "Appssemble SRL",
    tax_id: "RO12345678",
    address_lines: ["Strada Memorandumului 28", "400114 Cluj-Napoca", "RO"],
  },
  ...overrides,
});

// The step passes a function; evaluate it against a given payload.
const lastInterval = (subscription: object | null = null) => {
  const options = mockedSubscription.mock.lastCall?.[1] as {
    refetchInterval: (query: unknown) => number | false;
  };
  return options.refetchInterval({
    state: { data: { subscription, isEnterprise: false } },
  });
};

const setSubscription = (subscription: object | null) =>
  mockedSubscription.mockReturnValue({
    data: { subscription, isEnterprise: false },
  } as never);

let queryClient: QueryClient;

const renderDialog = (open = true, onOpenChange = vi.fn()) => {
  const ui = (isOpen: boolean) => (
    <QueryClientProvider client={queryClient}>
      <ScaleUpDialog open={isOpen} onOpenChange={onOpenChange} />
    </QueryClientProvider>
  );
  const utils = render(ui(open));
  return { onOpenChange, rerenderOpen: (o: boolean) => utils.rerender(ui(o)) };
};

const continueButton = () =>
  screen.getByRole("button", { name: "Continue to payment" });

const goToPayment = async () => {
  await act(async () => {
    fireEvent.click(continueButton());
  });
};

const subscribeButton = () =>
  screen.getByRole("button", { name: /Subscribe · \$2,500/ });

const completePayment = async () => {
  await goToPayment();
  await act(async () => {
    fireEvent.click(subscribeButton());
  });
};

// The Radix checkbox measures itself with ResizeObserver, which jsdom doesn't ship.
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
  queryClient = new QueryClient();
  mocks.mutateAsync.mockReset();
  mocks.mutateAsync.mockResolvedValue({ data: { client_secret: "cs_123" } });
  mocks.isPending = false;
  mocks.push.mockReset();
  mocks.stripe.value = Promise.resolve({});
  vi.mocked(showErrorNotification).mockReset();
  vi.mocked(trackEvent).mockReset();
  mocks.checkoutState.value = readyCheckout();
  mocks.confirm.mockReset();
  mocks.confirm.mockResolvedValue({ type: "success", session: {} });
  mocks.updateTaxIdInfo.mockReset();
  mocks.validateElements.mockReset();
  mocks.validateElements.mockResolvedValue({ type: "success", session: {} });
  mocks.providerOptions = [];
  mocks.getStripe.mockReset();
  mocks.getStripe.mockImplementation(() => mocks.stripe.value);
  setSubscription(null);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ScaleUpDialog plan picker", () => {
  it("shows the step tracker with Plan current and no back button", () => {
    renderDialog();
    const tracker = screen.getByRole("list", { name: "Progress" });
    expect(tracker).toHaveTextContent("1Plan");
    expect(tracker).toHaveTextContent("2Payment");
    expect(tracker).toHaveTextContent("3Done");
    expect(screen.getByText("Plan").closest("li")).toHaveAttribute(
      "aria-current",
      "step"
    );
    expect(screen.getByText("Upgrade project")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Flat price per band. Every feature included, no per-MAU bills."
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  });

  it("renders the three plan rows and both Contact sales links", () => {
    renderDialog();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByText("up to 250K MAU")).toBeInTheDocument();
    expect(screen.getByText("up to 500K MAU")).toBeInTheDocument();
    expect(screen.getByText("up to 1M MAU")).toBeInTheDocument();
    expect(screen.getByText("More than 1M MAU")).toBeInTheDocument();
    expect(screen.getByText("Self-hosted")).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: "Contact sales" });
    expect(links).toHaveLength(2);
    links.forEach((link) => {
      expect(link).toHaveAttribute("href", "https://example.com/sales");
      expect(link).toHaveAttribute("target", "_blank");
    });
  });

  it("defaults to Yearly + Growth 250K and continues with that choice", async () => {
    renderDialog();
    expect(screen.getByRole("button", { name: "Yearly" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getAllByRole("radio")[0]).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByText("Billed yearly")).toBeInTheDocument();
    await goToPayment();
    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      plan: "growth_250k",
      interval: "yearly",
    });
  });

  it("sends Scale + Monthly after selecting them", async () => {
    renderDialog();
    fireEvent.click(screen.getByRole("radio", { name: /Scale/ }));
    fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
    expect(screen.getByText("Billed monthly")).toBeInTheDocument();
    await goToPayment();
    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      plan: "scale_1m",
      interval: "monthly",
    });
  });

  it("selects a row when its text is clicked", async () => {
    renderDialog();
    fireEvent.click(screen.getByText("Same features, twice the headroom"));
    await goToPayment();
    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      plan: "growth_500k",
      interval: "yearly",
    });
  });

  it("shows crossed-out twelve-month totals only on Yearly", () => {
    renderDialog();
    expect(screen.getByText("$2,988")).toBeInTheDocument();
    expect(screen.getByText("$14,388")).toBeInTheDocument();
    expect(screen.getByText("12 × $249 monthly")).toBeInTheDocument();
    expect(screen.getByText("You save")).toBeInTheDocument();
    expect(screen.getAllByText("per year")).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
    expect(screen.queryByText("$2,988")).toBeNull();
    expect(screen.queryByText("$14,388")).toBeNull();
    expect(screen.queryByText("You save")).toBeNull();
    expect(screen.getAllByText("per month")).toHaveLength(3);
    expect(screen.getByText("Pay yearly instead")).toBeInTheDocument();
    expect(screen.getByText("$2,500 / year, save $488")).toBeInTheDocument();
  });

  it("switches the summary to Everything in Growth for Scale", () => {
    renderDialog();
    expect(screen.getByText("Everything in Free, plus")).toBeInTheDocument();
    expect(screen.getByText("Your own link domain")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Scale/ }));
    expect(screen.getByText("Everything in Growth, plus")).toBeInTheDocument();
    expect(screen.getByText("Scale, up to 1M MAU")).toBeInTheDocument();
    expect(
      screen.getByText("99.9% monthly uptime SLA with service credits")
    ).toBeInTheDocument();
  });

  it("resets to Yearly + Growth 250K when reopened", async () => {
    const { rerenderOpen } = renderDialog();
    fireEvent.click(screen.getByRole("radio", { name: /Scale/ }));
    fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
    rerenderOpen(false);
    rerenderOpen(true);
    await goToPayment();
    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      plan: "growth_250k",
      interval: "yearly",
    });
  });

  it("disables Continue while the session is being created", () => {
    mocks.isPending = true;
    renderDialog();
    expect(continueButton()).toBeDisabled();
  });

  it("shows the backend error text from a 422 body", async () => {
    mocks.mutateAsync.mockRejectedValueOnce(
      new ApiError("The provided data is invalid.", 422, undefined, {
        error: "Your payment is being processed. Refresh in a minute.",
      })
    );
    renderDialog();
    await goToPayment();
    expect(showErrorNotification).toHaveBeenCalledWith(
      "Your payment is being processed. Refresh in a minute."
    );
  });

  it("shows backend errors as-is and stays on the plan step", async () => {
    mocks.mutateAsync.mockRejectedValueOnce(
      new ApiError("This project already has a plan", 422)
    );
    renderDialog();
    await goToPayment();
    expect(showErrorNotification).toHaveBeenCalledWith(
      "This project already has a plan"
    );
    expect(screen.queryByTestId("stripe-provider")).toBeNull();
    expect(continueButton()).toBeInTheDocument();
  });
});

describe("ScaleUpDialog payment step", () => {
  it("loads Stripe.js only once the payment step mounts", async () => {
    renderDialog();
    expect(mocks.getStripe).not.toHaveBeenCalled();
    await goToPayment();
    expect(mocks.getStripe).toHaveBeenCalled();
  });

  it("renders our form inside the Checkout Elements provider", async () => {
    renderDialog();
    await goToPayment();
    expect(screen.getByTestId("stripe-provider")).toHaveAttribute(
      "data-client-secret",
      "cs_123"
    );
    expect(mocks.providerOptions.at(-1)).toMatchObject({
      clientSecret: "cs_123",
      elementsOptions: {
        appearance: {
          theme: "stripe",
          variables: { colorPrimary: "#2A86FF", borderRadius: "8px" },
        },
      },
    });
    expect(screen.getByText("dev@example.com")).toBeInTheDocument();
    const payment = screen.getByTestId("payment-element");
    const billing = screen.getByTestId("billing-address-element");
    expect(
      payment.compareDocumentPosition(billing) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(screen.queryByTestId("tax-id-element")).toBeNull();
    expect(subscribeButton()).toBeEnabled();
    expect(
      screen.getByText(
        "By subscribing, you allow grovs to charge you $2,500 per year until you cancel."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Card details go straight to Stripe; grovs never sees them/
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Continue to payment" })
    ).toBeNull();
  });

  it("uses the monthly price and wording for monthly billing", async () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
    await goToPayment();
    expect(
      screen.getByRole("button", { name: /Subscribe · \$249$/ })
    ).toBeInTheDocument();
    expect(screen.getByText(/charge you \$249 per month/)).toBeInTheDocument();
  });

  it("reveals Stripe's tax ID element for businesses and clears it when unchecked", async () => {
    renderDialog();
    await goToPayment();
    const checkbox = screen.getByRole("checkbox", {
      name: "I'm purchasing as a business",
    });
    fireEvent.click(checkbox);
    const taxId = screen.getByTestId("tax-id-element");
    expect(JSON.parse(taxId.dataset.options!)).toEqual({
      visibility: "always",
      fields: { businessName: "always" },
      validation: { businessName: { required: "always" } },
    });
    fireEvent.click(checkbox);
    expect(screen.queryByTestId("tax-id-element")).toBeNull();
    expect(mocks.updateTaxIdInfo).not.toHaveBeenCalled();

    mocks.checkoutState.value = readyCheckout({
      taxIdInfo: {
        businessName: "Acme",
        taxId: { type: "eu_vat", value: "DE1" },
      },
    });
    fireEvent.click(checkbox);
    fireEvent.click(checkbox);
    expect(mocks.updateTaxIdInfo).toHaveBeenCalledWith(null);
  });

  it("shows Stripe's validation error above the button and re-enables it", async () => {
    mocks.confirm.mockResolvedValueOnce({
      type: "error",
      error: { message: "Your address is incomplete." },
    });
    renderDialog();
    await completePayment();
    expect(mocks.confirm).toHaveBeenCalledWith({
      redirect: "if_required",
      returnUrl: window.location.href,
    });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Your address is incomplete.");
    expect(
      alert.compareDocumentPosition(subscribeButton()) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(subscribeButton()).toBeEnabled();
    expect(screen.queryByLabelText("Processing")).toBeNull();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it.each([
    [
      "a resolved {type:error}",
      () =>
        mocks.confirm.mockResolvedValueOnce({
          type: "error",
          error: { message: "Please provide your full name.", code: null },
        }),
      "Please provide your full name.",
    ],
    [
      "a resolved bare {error}",
      () =>
        mocks.confirm.mockResolvedValueOnce({
          error: { message: "Your card number is incomplete." },
        }),
      "Your card number is incomplete.",
    ],
    [
      "a thrown IntegrationError",
      () => {
        const error = new Error("You must provide a `returnUrl` on confirm().");
        error.name = "IntegrationError";
        mocks.confirm.mockRejectedValueOnce(error);
      },
      "You must provide a `returnUrl` on confirm().",
    ],
    [
      "a thrown {message} object",
      () => mocks.confirm.mockRejectedValueOnce({ message: "Network error." }),
      "Network error.",
    ],
    [
      "a thrown value without a message",
      () => mocks.confirm.mockRejectedValueOnce("boom"),
      "Something went wrong. Please try again.",
    ],
    [
      "an error result without a message",
      () => mocks.confirm.mockResolvedValueOnce({ type: "error", error: {} }),
      "Something went wrong. Please try again.",
    ],
  ])(
    "shows Stripe's message for %s and logs it in dev",
    async (_, arrange, message) => {
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      arrange();
      renderDialog();
      await completePayment();
      expect(screen.getByRole("alert")).toHaveTextContent(message);
      expect(subscribeButton()).toBeEnabled();
      expect(log).toHaveBeenCalledTimes(1);
      expect(log.mock.calls[0]?.[0]).toBe("Stripe confirm failed");
      log.mockRestore();
    }
  );

  it("asks to fill the highlighted fields without confirming when incomplete", async () => {
    mocks.checkoutState.value = readyCheckout({ canConfirm: false });
    renderDialog();
    await completePayment();
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(mocks.validateElements).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Fill in the highlighted fields to continue."
    );
    expect(subscribeButton()).toBeEnabled();
  });

  it("clears the error when a field changes or on retry", async () => {
    mocks.confirm.mockResolvedValue({
      type: "error",
      error: { message: "Your address is incomplete." },
    });
    renderDialog();
    await completePayment();
    fireEvent.click(screen.getByRole("button", { name: "Edit address" }));
    expect(screen.queryByRole("alert")).toBeNull();

    await act(async () => {
      fireEvent.click(subscribeButton());
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit card" }));
    expect(screen.queryByRole("alert")).toBeNull();

    let resolve: (value: unknown) => void = () => {};
    mocks.confirm.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    await act(async () => {
      fireEvent.click(subscribeButton());
    });
    expect(screen.queryByRole("alert")).toBeNull();
    await act(async () => {
      resolve({ type: "success", session: {} });
    });
    expect(screen.getByText("Payment received")).toBeInTheDocument();
  });

  it("completes only once even if confirm resolves twice", async () => {
    const resolvers: ((value: unknown) => void)[] = [];
    mocks.confirm.mockImplementation(
      () => new Promise((r) => resolvers.push(r))
    );
    renderDialog();
    await goToPayment();
    const form = subscribeButton().closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
      fireEvent.submit(form);
    });
    await act(async () => {
      resolvers.forEach((resolve) => resolve({ type: "success", session: {} }));
    });
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Payment received")).toBeInTheDocument();
  });

  it("locks back, change, close and Escape while confirming", async () => {
    let resolve: (value: unknown) => void = () => {};
    mocks.confirm.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const { onOpenChange } = renderDialog();
    await completePayment();
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Change" })).toBeDisabled();
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    expect(onOpenChange).not.toHaveBeenCalled();
    await act(async () => {
      resolve({ type: "error", error: { message: "Declined" } });
    });
    expect(screen.getByRole("button", { name: "Back" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Close" })).toBeEnabled();
  });

  it("does not close when the Stripe 3DS lightbox is clicked", async () => {
    const { onOpenChange } = renderDialog();
    await goToPayment();
    const lightbox = document.createElement("div");
    lightbox.innerHTML = '<iframe name="__privateStripeFrame42"></iframe>';
    document.body.appendChild(lightbox);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    fireEvent.pointerDown(lightbox);
    fireEvent.focusIn(lightbox.querySelector("iframe")!);
    expect(onOpenChange).not.toHaveBeenCalled();
    lightbox.remove();

    const outside = document.createElement("div");
    document.body.appendChild(outside);
    fireEvent.pointerDown(outside);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    outside.remove();
  });

  it("disables the button with a spinner while confirming", async () => {
    let resolve: (value: unknown) => void = () => {};
    mocks.confirm.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    renderDialog();
    await completePayment();
    expect(subscribeButton()).toBeDisabled();
    expect(screen.getByLabelText("Processing")).toBeInTheDocument();
    await act(async () => {
      resolve({ type: "success", session: {} });
    });
    expect(screen.getByText("Payment received")).toBeInTheDocument();
  });

  it("shows a skeleton while Stripe loads and the error if init fails", async () => {
    mocks.checkoutState.value = { type: "loading" };
    const { rerenderOpen } = renderDialog();
    await goToPayment();
    expect(screen.getByLabelText("Loading payment form")).toBeInTheDocument();
    mocks.checkoutState.value = {
      type: "error",
      error: { message: "This Checkout Session is no longer active." },
    };
    rerenderOpen(true);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This Checkout Session is no longer active."
    );
  });

  it("goes back to the plan step and creates a new session next time", async () => {
    renderDialog();
    await goToPayment();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.queryByTestId("stripe-provider")).toBeNull();
    expect(continueButton()).toBeInTheDocument();
    mocks.mutateAsync.mockResolvedValueOnce({
      data: { client_secret: "cs_456" },
    });
    await goToPayment();
    expect(mocks.mutateAsync).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("stripe-provider")).toHaveAttribute(
      "data-client-secret",
      "cs_456"
    );
  });

  it("Change in the summary also goes back", async () => {
    renderDialog();
    await goToPayment();
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    expect(continueButton()).toBeInTheDocument();
  });

  it("shows an inline error without creating a session when Stripe is not configured", async () => {
    mocks.stripe.value = null;
    renderDialog();
    await goToPayment();
    expect(
      screen.getByText("Payments aren't configured for this environment")
    ).toBeInTheDocument();
    expect(screen.queryByTestId("stripe-provider")).toBeNull();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it("shows a load error when Stripe.js fails to load", async () => {
    mocks.stripe.value = Promise.resolve(null);
    renderDialog();
    await goToPayment();
    expect(
      await screen.findByText(
        "Couldn't load the payment form. Check your connection or disable blockers for this page, then try again."
      )
    ).toBeInTheDocument();
    expect(screen.queryByTestId("stripe-provider")).toBeNull();
  });
});

describe("ScaleUpDialog activation and receipt", () => {
  it("tracks the purchase only when confirm succeeds", async () => {
    renderDialog();
    await goToPayment();
    expect(trackEvent).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(subscribeButton());
    });
    expect(trackEvent).toHaveBeenCalledWith("purchase", {
      instanceId: "inst_1",
      plan: "growth_250k",
      interval: "yearly",
    });
  });

  it("moves to activating on complete and polls the subscription", async () => {
    renderDialog();
    await completePayment();
    expect(screen.getByText("Payment received")).toBeInTheDocument();
    expect(screen.getByText("Payment confirmed by Stripe")).toBeInTheDocument();
    expect(screen.getByText("$2,500.00 charged")).toBeInTheDocument();
    expect(
      screen.getByText("Switching the project to Growth")
    ).toBeInTheDocument();
    expect(screen.getByText(/10K to 250K/)).toBeInTheDocument();
    expect(screen.getByText("Unlocking Growth features")).toBeInTheDocument();
    expect(lastInterval()).toBe(1500);
  });

  it("waits while the payload is not active yet", async () => {
    setSubscription(activeSub({ details: { active: false, paused: false } }));
    renderDialog();
    await completePayment();
    expect(screen.getByText("Payment received")).toBeInTheDocument();
  });

  it("shows the done step with the receipt once active", async () => {
    const { rerenderOpen } = renderDialog();
    await completePayment();
    setSubscription(activeSub());
    rerenderOpen(true);

    expect(screen.getByText("This project is on Growth")).toBeInTheDocument();
    expect(
      screen.getByText(/on their way to dev@example.com/)
    ).toBeInTheDocument();
    expect(screen.queryByText("Payment")).toBeNull();
    expect(screen.getByText("Invoice 4F2A1C-0001")).toBeInTheDocument();
    expect(screen.getByText("Billed to")).toBeInTheDocument();
    expect(screen.getByText("Appssemble SRL")).toBeInTheDocument();
    expect(screen.getByText("RO12345678")).toBeInTheDocument();
    expect(screen.getByText("400114 Cluj-Napoca")).toBeInTheDocument();
    const pdf = screen.getByRole("link", { name: /Download invoice PDF/ });
    expect(pdf).toHaveAttribute("href", "https://pay.stripe.com/invoice/pdf");
    expect(pdf).toHaveAttribute("target", "_blank");
    expect(screen.getByText("Custom link domain")).toBeInTheDocument();
    expect(screen.getByText("Event stream")).toBeInTheDocument();
    expect(screen.getByText("Raw event retention")).toBeInTheDocument();
    expect(lastInterval(activeSub())).toBe(false);
  });

  it("hides the PDF link and Billed to when the invoice is missing", async () => {
    const { rerenderOpen } = renderDialog();
    await completePayment();
    setSubscription(activeSub({ latest_invoice: null, billed_to: null }));
    rerenderOpen(true);
    expect(screen.getByText("This project is on Growth")).toBeInTheDocument();
    expect(screen.queryByText("Billed to")).toBeNull();
    expect(
      screen.queryByRole("link", { name: /Download invoice PDF/ })
    ).toBeNull();
  });

  it("shows receipt details only for a paid invoice", async () => {
    const { rerenderOpen } = renderDialog();
    await completePayment();
    setSubscription(
      activeSub({
        latest_invoice: {
          number: null,
          invoice_pdf: null,
          hosted_invoice_url: null,
          amount_paid: 0,
          status: "draft",
          paid_at: null,
        },
      })
    );
    rerenderOpen(true);
    expect(screen.getByText("This project is on Growth")).toBeInTheDocument();
    expect(screen.queryByText(/^Invoice /)).toBeNull();
    expect(screen.queryByText("$0.00")).toBeNull();
    expect(screen.queryByText(/^Paid /)).toBeNull();
    expect(
      screen.queryByRole("link", { name: /Download invoice PDF/ })
    ).toBeNull();
    expect(screen.getByText("Next renewal")).toBeInTheDocument();
    expect(screen.getByText("Billed to")).toBeInTheDocument();
  });

  it("keeps refetching for up to 30s until the invoice is paid", async () => {
    const draft = activeSub({
      latest_invoice: {
        number: null,
        invoice_pdf: null,
        hosted_invoice_url: null,
        amount_paid: 0,
        status: "open",
        paid_at: null,
      },
    });
    const { rerenderOpen } = renderDialog();
    await goToPayment();
    vi.useFakeTimers();
    await act(async () => {
      fireEvent.click(subscribeButton());
    });
    setSubscription(draft);
    rerenderOpen(true);
    expect(screen.getByText("This project is on Growth")).toBeInTheDocument();
    expect(lastInterval(draft)).toBe(4000);
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(lastInterval(draft)).toBe(false);
  });

  it("hides Billed to when all its fields are empty", async () => {
    const { rerenderOpen } = renderDialog();
    await completePayment();
    setSubscription(
      activeSub({ billed_to: { name: null, tax_id: null, address_lines: [] } })
    );
    rerenderOpen(true);
    expect(screen.queryByText("Billed to")).toBeNull();
    expect(screen.getByText("$2,500.00")).toBeInTheDocument();
  });

  it("Done closes the dialog and refreshes the subscription", async () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { onOpenChange, rerenderOpen } = renderDialog();
    await completePayment();
    setSubscription(activeSub());
    rerenderOpen(true);
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["payments", "subscription", "inst_1"],
    });
  });

  it("next steps close the dialog and keep the query params", async () => {
    const { onOpenChange, rerenderOpen } = renderDialog();
    await completePayment();
    setSubscription(activeSub());
    rerenderOpen(true);
    fireEvent.click(
      screen.getByRole("button", { name: /Add your link domain/ })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mocks.push).toHaveBeenCalledWith(
      "/dynamic_links/settings/domain?instance_id=inst_1"
    );
    fireEvent.click(screen.getByRole("button", { name: /Stream your events/ }));
    expect(mocks.push).toHaveBeenCalledWith(
      "/settings/developers/event_stream?instance_id=inst_1"
    );
  });

  it("stops polling after 3 minutes and says the payment is safe", async () => {
    renderDialog();
    await goToPayment();
    vi.useFakeTimers();
    await act(async () => {
      fireEvent.click(subscribeButton());
    });
    act(() => {
      vi.advanceTimersByTime(179_000);
    });
    expect(screen.queryByText("Still activating")).toBeNull();
    expect(lastInterval()).toBe(1500);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText("Still activating")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Your payment is safe. If your plan isn't active in a few minutes, contact support."
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/It takes a few seconds/)).toBeNull();
    expect(document.querySelector(".animate-spin")).toBeNull();
    expect(screen.getByText("Payment confirmed by Stripe")).toBeInTheDocument();
    expect(lastInterval()).toBe(false);
    expect(screen.getAllByRole("button", { name: "Close" })).toHaveLength(2);
  });

  it("stops polling and asks to fix billing on a payment issue", async () => {
    const { onOpenChange, rerenderOpen } = renderDialog();
    await completePayment();
    const issue = activeSub({
      payment_issue: true,
      status: "past_due",
      details: { active: false, paused: false },
    });
    expect(lastInterval(issue)).toBe(false);
    setSubscription(issue);
    rerenderOpen(true);
    expect(screen.getByText("Payment needs attention")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Your payment didn't go through. Open Manage billing to update your card, then try again."
    );
    expect(screen.queryByText(/It takes a few seconds/)).toBeNull();
    expect(screen.queryByText("Payment confirmed by Stripe")).toBeNull();
    expect(screen.getByText("Payment didn't go through")).toBeInTheDocument();
    expect(document.querySelector(".animate-spin")).toBeNull();
    expect(document.querySelector(".bg-destructive")).not.toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "Close" })[1]!);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("ignores payment_issue while the subscription is still pending", async () => {
    const { rerenderOpen } = renderDialog();
    await completePayment();
    const pending = activeSub({
      payment_issue: true,
      status: "pending",
      details: { active: false, paused: false },
    });
    expect(lastInterval(pending)).toBe(1500);
    setSubscription(pending);
    rerenderOpen(true);
    expect(screen.getByText("Payment received")).toBeInTheDocument();
    expect(screen.queryByText("Payment needs attention")).toBeNull();
  });

  it("background refetch doesn't cancel a slow in-flight request", async () => {
    vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);
    const signals: AbortSignal[] = [];
    const slowFetch = vi.fn(
      ({ signal }: { signal: AbortSignal }) =>
        new Promise((resolve) => {
          signals.push(signal);
          setTimeout(
            () => resolve({ subscription: null, isEnterprise: false }),
            10_000
          );
        })
    );
    const { rerenderOpen } = renderDialog();
    await goToPayment();
    vi.useFakeTimers();
    await act(async () => {
      fireEvent.click(subscribeButton());
    });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    rerenderOpen(false);
    // Stale cached data plus an observer (the plan card) starts the slow fetch.
    queryClient.setQueryData(["payments", "subscription", "inst_1"], {
      subscription: null,
      isEnterprise: false,
    });
    const unsubscribe = new QueryObserver(queryClient, {
      queryKey: ["payments", "subscription", "inst_1"],
      queryFn: slowFetch,
    }).subscribe(() => {});
    for (let i = 0; i < 2; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
    }
    expect(slowFetch).toHaveBeenCalledTimes(1);
    expect(signals[0]!.aborted).toBe(false);
    unsubscribe();
  });

  it("closing mid-activation keeps refetching the plan every 3s until active", async () => {
    vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);
    const refetch = vi
      .spyOn(queryClient, "refetchQueries")
      .mockResolvedValue(undefined);
    const key = ["payments", "subscription", "inst_1"];
    const { rerenderOpen } = renderDialog();
    await goToPayment();
    vi.useFakeTimers();
    await act(async () => {
      fireEvent.click(subscribeButton());
    });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    rerenderOpen(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(refetch).toHaveBeenCalledWith(
      { queryKey: key },
      { cancelRefetch: false }
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(refetch).toHaveBeenCalledTimes(2);
    queryClient.setQueryData(key, {
      subscription: activeSub(),
      isEnterprise: false,
    });
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
    }
    expect(refetch).toHaveBeenCalledTimes(3);
  });

  it("gives up the background refetch after 2 minutes", async () => {
    vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);
    const refetch = vi
      .spyOn(queryClient, "refetchQueries")
      .mockResolvedValue(undefined);
    const { rerenderOpen } = renderDialog();
    await goToPayment();
    vi.useFakeTimers();
    await act(async () => {
      fireEvent.click(subscribeButton());
    });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    rerenderOpen(false);
    for (let i = 0; i < 40; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
    }
    const calls = refetch.mock.calls.length;
    expect(calls).toBeGreaterThanOrEqual(39);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(refetch).toHaveBeenCalledTimes(calls);
  });

  it("does not refetch in the background when closed before activation", async () => {
    vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);
    const refetch = vi.spyOn(queryClient, "refetchQueries");
    const { rerenderOpen } = renderDialog();
    await goToPayment();
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    rerenderOpen(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(refetch).not.toHaveBeenCalled();
  });

  it("starts at the plan step again after closing", async () => {
    const { rerenderOpen } = renderDialog();
    await completePayment();
    rerenderOpen(false);
    rerenderOpen(true);
    expect(continueButton()).toBeInTheDocument();
    expect(screen.queryByText("Payment received")).toBeNull();
  });
});

describe("ScaleUpDialog with a plan chosen elsewhere", () => {
  const renderChosen = (onPurchased = vi.fn(), onOpenChange = vi.fn()) => {
    const ui = (isOpen: boolean) => (
      <QueryClientProvider client={queryClient}>
        <ScaleUpDialog
          open={isOpen}
          onOpenChange={onOpenChange}
          initialChoice={{ plan: "scale_1m", interval: "monthly" }}
          onPurchased={onPurchased}
        />
      </QueryClientProvider>
    );
    const utils = render(ui(true));
    return {
      onPurchased,
      onOpenChange,
      rerenderOpen: (o: boolean) => utils.rerender(ui(o)),
    };
  };

  it("opens straight on payment for that plan with the summary first", async () => {
    await act(async () => {
      renderChosen();
    });
    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      plan: "scale_1m",
      interval: "monthly",
    });
    expect(screen.getByTestId("stripe-provider")).toBeInTheDocument();
    expect(screen.getByText("Scale 1M · billed monthly")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Subscribe · \$1,199$/ })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Continue to payment" })
    ).toBeNull();
  });

  it("falls back to the plan picker when the session can't start", async () => {
    mocks.mutateAsync.mockRejectedValueOnce(new Error("nope"));
    await act(async () => {
      renderChosen();
    });
    expect(continueButton()).toBeInTheDocument();
    expect(screen.getByText("Billed monthly")).toBeInTheDocument();
  });

  it("goes back to the plans from Back", async () => {
    await act(async () => {
      renderChosen();
    });
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(continueButton()).toBeInTheDocument();
  });

  it("reports the purchase when closed after it's done", async () => {
    let utils!: ReturnType<typeof renderChosen>;
    await act(async () => {
      utils = renderChosen();
    });
    await act(async () => {
      fireEvent.click(subscribeButtonFor("$1,199"));
    });
    setSubscription(activeSub());
    utils.rerenderOpen(true);
    expect(screen.getByText(/This project is on/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(utils.onPurchased).toHaveBeenCalled();
  });
});

function subscribeButtonFor(price: string) {
  return screen.getByRole("button", {
    name: new RegExp(`Subscribe · \\${price}`),
  });
}
