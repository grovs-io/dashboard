import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@/lib/ApiError";

vi.mock("@/hooks/queries/useConfigurationQueries", () => ({
  // Setup uses the plural list envelope; the dialog the singular one.
  useCustomDomainsEnvelopeQuery: vi.fn(),
  useCustomDomainEnvelopeQuery: vi.fn(),
  useCustomDomainPreflightQuery: vi.fn(),
}));

vi.mock("@/lib/edition", () => ({
  IS_ENTERPRISE: false,
  IS_SELF_HOSTED: true,
}));

vi.mock("@/hooks/queries/usePaymentsQueries", () => ({
  useSubscriptionQuery: vi.fn(),
}));

vi.mock("@/hooks/queries/useInstanceQueries", () => ({
  useInstanceDetailsQuery: vi.fn(),
}));

vi.mock("@/context/useProjectSelection", () => ({
  useProjectSelection: vi.fn(),
}));

vi.mock("@/hooks/mutations/useConfigurationMutations", () => ({
  useAddCustomDomainMutation: vi.fn(),
  useRemoveCustomDomainMutation: vi.fn(),
  useVerifyCustomDomainMutation: vi.fn(),
}));

vi.mock("@/hooks/mutations/usePaymentsMutations", () => ({
  useCreateSubscriptionMutation: vi.fn(),
}));

vi.mock("@/lib/Notifications", () => ({
  showRetryableError: vi.fn(),
  showSuccessNotification: vi.fn(),
}));

vi.mock("@/lib/copyTextHelper", () => ({ handleCopyText: vi.fn() }));

vi.mock("@/lib/config", () => ({
  config: {
    pricingUrl: "https://example.com/pricing",
    supportEmail: "support@example.com",
  },
}));

import {
  useCustomDomainsEnvelopeQuery,
  useCustomDomainEnvelopeQuery,
  useCustomDomainPreflightQuery,
} from "@/hooks/queries/useConfigurationQueries";
import { useSubscriptionQuery } from "@/hooks/queries/usePaymentsQueries";
import { useInstanceDetailsQuery } from "@/hooks/queries/useInstanceQueries";
import { useProjectSelection } from "@/context/useProjectSelection";
import {
  useAddCustomDomainMutation,
  useRemoveCustomDomainMutation,
  useVerifyCustomDomainMutation,
} from "@/hooks/mutations/useConfigurationMutations";
import { useCreateSubscriptionMutation } from "@/hooks/mutations/usePaymentsMutations";
import CustomDomainSetup from "../configuration/CustomDomainSetup";

const mockedQuery = vi.mocked(useCustomDomainsEnvelopeQuery);
const mockedSingularQuery = vi.mocked(useCustomDomainEnvelopeQuery);
const mockedVerifyMutation = vi.mocked(useVerifyCustomDomainMutation);
const mockedPreflightQuery = vi.mocked(useCustomDomainPreflightQuery);
const mockedSubscription = vi.mocked(useSubscriptionQuery);
const mockedInstanceDetails = vi.mocked(useInstanceDetailsQuery);
const mockedProjectSelection = vi.mocked(useProjectSelection);
const mockedAddMutation = vi.mocked(useAddCustomDomainMutation);
const mockedRemoveMutation = vi.mocked(useRemoveCustomDomainMutation);
const mockedCreateSubscription = vi.mocked(useCreateSubscriptionMutation);

// The component uses useQueryClient (popup-close reconciliation), so renders
// need a real provider even though the query hooks themselves are mocked.
const renderWithClient = (ui: React.ReactElement) =>
  render(
    <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>
  );

// `data` is the rows array; the helper wraps it in the list envelope.
function setQuery(
  partial: Record<string, unknown>,
  envelope: Record<string, unknown> = {}
) {
  const { data, ...rest } = partial as { data?: unknown };
  mockedQuery.mockReturnValue({
    data: { custom_domains: data ?? [], ...envelope },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...rest,
  } as never);
}

function setSubscription(subscription: unknown) {
  mockedSubscription.mockReturnValue({
    data: { subscription, isEnterprise: false },
  } as never);
}

describe("CustomDomainSetup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedProjectSelection.mockReturnValue({
      selectedInstance: { id: "inst-1" },
    } as never);
    setSubscription({ type: "pro" });
    mockedInstanceDetails.mockReturnValue({
      data: { get_started_setup: { ios_sdk: false, android_sdk: false } },
    } as never);
    mockedAddMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
    mockedRemoveMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
    mockedCreateSubscription.mockReturnValue({
      mutateAsync: vi.fn(),
    } as never);
    // Default singular-envelope stub for the dialog rendered on open.
    mockedSingularQuery.mockReturnValue({
      data: { custom_domain: null },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);
    mockedVerifyMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
    mockedPreflightQuery.mockReturnValue({
      data: null,
      isFetching: false,
      isLoading: false,
    } as never);
  });

  it("renders nothing when the feature is unavailable (404)", () => {
    setQuery({ isError: true, error: new ApiError("x", 404) });
    const { container } = renderWithClient(
      <CustomDomainSetup projectId="p1" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a skeleton while the domain list is loading", () => {
    setQuery({ data: undefined, isLoading: true });
    renderWithClient(<CustomDomainSetup projectId="p1" />);
    expect(
      screen.queryByRole("button", { name: /use your own subdomain/i })
    ).toBeNull();
  });

  it("shows the entry button in the None state", () => {
    setQuery({ data: [] });
    renderWithClient(<CustomDomainSetup projectId="p1" />);
    expect(
      screen.getByRole("button", { name: /use your own subdomain/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/serve new grovs links from a branded subdomain/i)
    ).toBeInTheDocument();
  });

  it("shows the active subdomain in a field row with a Manage action", () => {
    setQuery({
      data: [
        {
          hostname: "links.acme.com",
          purpose: "primary",
          status: "active",
          cname_target: "x.cdn.example",
        },
      ],
    });
    renderWithClient(<CustomDomainSetup projectId="p1" />);
    expect(screen.getByText("links.acme.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /manage/i })).toBeInTheDocument();
  });

  it("shows a Pending chip with a View setup action", () => {
    setQuery({
      data: [
        {
          hostname: "links.acme.com",
          purpose: "primary",
          status: "pending",
          cname_target: "x.cdn.example",
        },
      ],
    });
    renderWithClient(<CustomDomainSetup projectId="p1" />);
    expect(screen.getByText(/pending/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /view setup/i })
    ).toBeInTheDocument();
  });

  it("shows Verifying + View setup for an active domain whose CNAME is not pointed", () => {
    setQuery({
      data: [
        {
          hostname: "links.acme.com",
          purpose: "primary",
          status: "active",
          ssl_status: "active",
          ssl_validation_txt_records: [],
          cname_target: "x.cdn.example",
        },
      ],
    });
    mockedPreflightQuery.mockReturnValue({
      data: { hostname: "links.acme.com", cname_matches: false },
      isFetching: false,
      isLoading: false,
    } as never);
    renderWithClient(<CustomDomainSetup projectId="p1" />);
    expect(screen.getByText("Verifying")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /view setup/i })
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /manage/i })).toBeNull();
  });

  it("shows Manage for an active domain once the CNAME matches", () => {
    setQuery({
      data: [
        {
          hostname: "links.acme.com",
          purpose: "primary",
          status: "active",
          ssl_status: "active",
          ssl_validation_txt_records: [],
          cname_target: "x.cdn.example",
        },
      ],
    });
    mockedPreflightQuery.mockReturnValue({
      data: { hostname: "links.acme.com", cname_matches: true },
      isFetching: false,
      isLoading: false,
    } as never);
    renderWithClient(<CustomDomainSetup projectId="p1" />);
    expect(screen.getByRole("button", { name: /manage/i })).toBeInTheDocument();
  });

  it("treats a provisioning domain like pending, not like no domain", () => {
    setQuery({
      data: [
        {
          hostname: "links.acme.com",
          purpose: "primary",
          status: "provisioning",
          cname_target: "x.cdn.example",
        },
      ],
    });
    renderWithClient(<CustomDomainSetup projectId="p1" />);
    expect(
      screen.getByRole("button", { name: /view setup/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /use your own subdomain/i })
    ).toBeNull();
  });

  it("shows a Failed chip with a Fix action", () => {
    setQuery({
      data: [
        {
          hostname: "links.acme.com",
          purpose: "primary",
          status: "failed",
          cname_target: "x.cdn.example",
        },
      ],
    });
    renderWithClient(<CustomDomainSetup projectId="p1" />);
    expect(screen.getByText(/verification failed/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /fix/i })).toBeInTheDocument();
  });

  it("opens the dialog when the entry button is clicked", () => {
    setQuery({ data: [] });
    renderWithClient(<CustomDomainSetup projectId="p1" />);
    // Dialog body not present until opened.
    expect(screen.queryByPlaceholderText("links.acme.com")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: /use your own subdomain/i })
    );
    expect(screen.getByPlaceholderText("links.acme.com")).toBeInTheDocument();
  });

  it("opens the dialog to the upsell when there is no paid plan", () => {
    setQuery({ data: [] });
    setSubscription(null);
    renderWithClient(<CustomDomainSetup projectId="p1" />);
    fireEvent.click(
      screen.getByRole("button", { name: /use your own subdomain/i })
    );
    expect(screen.getByText(/requires a paid plan/i)).toBeInTheDocument();
  });

  it("opens the Scale Up plans popup from the upsell View plans", () => {
    setQuery({ data: [] });
    setSubscription(null);
    renderWithClient(<CustomDomainSetup projectId="p1" />);
    fireEvent.click(
      screen.getByRole("button", { name: /use your own subdomain/i })
    );
    fireEvent.click(screen.getByRole("button", { name: /view plans/i }));
    // The custom-domain modal closes and the Scale Up plans popup opens.
    expect(screen.getByText("Scale Up")).toBeInTheDocument();
    expect(screen.queryByText(/requires a paid plan/i)).toBeNull();
  });

  it("refetches the domain queries when the popup closes", async () => {
    const { queryKeys } = await import("@/lib/queryKeys");
    setQuery({
      data: [
        {
          hostname: "links.acme.com",
          purpose: "primary",
          status: "pending",
          cname_target: "x.cdn.example",
        },
      ],
    });
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    render(
      <QueryClientProvider client={client}>
        <CustomDomainSetup projectId="p1" />
      </QueryClientProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: /view setup/i }));
    expect(invalidateSpy).not.toHaveBeenCalled();
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.projects.customDomains("p1"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.projects.customDomain("p1"),
    });
  });

  it("ignores migration-purpose rows when picking the primary row", () => {
    // Only a migration row exists — the primary card should show the
    // empty None-state entry button, not the migration hostname.
    setQuery({
      data: [
        {
          hostname: "old.acme.com",
          purpose: "migration",
          status: "active",
          cname_target: "proxy-fallback.sqd.link",
        },
      ],
    });
    renderWithClient(<CustomDomainSetup projectId="p1" />);
    expect(screen.queryByText("old.acme.com")).toBeNull();
    expect(
      screen.getByRole("button", { name: /use your own subdomain/i })
    ).toBeInTheDocument();
  });

  describe("manual mode", () => {
    const manualEnvelope = {
      tls_mode: "manual",
      ingress_host: "links.app.com",
    };
    const activeManualRow = {
      hostname: "links.acme.com",
      purpose: "primary",
      status: "active",
      ssl_status: null,
      cname_target: "links.app.com",
      setup_records: [],
    };

    it("shows Manage for an active manual row even when the CNAME preflight fails", () => {
      setQuery({ data: [activeManualRow] }, manualEnvelope);
      mockedPreflightQuery.mockReturnValue({
        data: { hostname: "links.acme.com", cname_matches: false },
        isFetching: false,
        isLoading: false,
      } as never);
      renderWithClient(<CustomDomainSetup projectId="p1" />);
      expect(
        screen.getByRole("button", { name: /manage/i })
      ).toBeInTheDocument();
      expect(screen.queryByText("Verifying")).toBeNull();
    });

    it("opens the dialog to the add form, not the upsell, without a paid plan", () => {
      setQuery({ data: [] }, manualEnvelope);
      setSubscription(null);
      mockedSingularQuery.mockReturnValue({
        data: { custom_domain: null, ...manualEnvelope },
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      } as never);
      renderWithClient(<CustomDomainSetup projectId="p1" />);
      fireEvent.click(
        screen.getByRole("button", { name: /use your own subdomain/i })
      );
      expect(screen.queryByText(/requires a paid plan/i)).toBeNull();
      expect(screen.getByPlaceholderText("links.acme.com")).toBeInTheDocument();
    });
  });
});
