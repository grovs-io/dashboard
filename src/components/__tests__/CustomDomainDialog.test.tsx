import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ApiError } from "@/lib/ApiError";

vi.mock("@/hooks/queries/useConfigurationQueries", () => ({
  useCustomDomainEnvelopeQuery: vi.fn(),
  useCustomDomainPreflightQuery: vi.fn(),
}));

vi.mock("@/hooks/mutations/useConfigurationMutations", () => ({
  useAddCustomDomainMutation: vi.fn(),
  useRemoveCustomDomainMutation: vi.fn(),
  useVerifyCustomDomainMutation: vi.fn(),
}));

// Manual-mode branches require the self-hosted build flag.
vi.mock("@/lib/edition", () => ({
  IS_ENTERPRISE: false,
  IS_SELF_HOSTED: true,
}));

vi.mock("@/lib/Notifications", () => ({
  showRetryableError: vi.fn(),
  showSuccessNotification: vi.fn(),
}));

vi.mock("@/lib/copyTextHelper", () => ({
  handleCopyText: vi.fn(),
}));

vi.mock("@/lib/config", () => ({
  config: {
    pricingUrl: "https://example.com/pricing",
    supportEmail: "support@example.com",
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

import {
  useCustomDomainEnvelopeQuery,
  useCustomDomainPreflightQuery,
} from "@/hooks/queries/useConfigurationQueries";
import {
  useAddCustomDomainMutation,
  useRemoveCustomDomainMutation,
  useVerifyCustomDomainMutation,
} from "@/hooks/mutations/useConfigurationMutations";
import { showRetryableError } from "@/lib/Notifications";
import { handleCopyText } from "@/lib/copyTextHelper";
import CustomDomainDialog from "../configuration/CustomDomainDialog";

const mockedQuery = vi.mocked(useCustomDomainEnvelopeQuery);
const mockedPreflightQuery = vi.mocked(useCustomDomainPreflightQuery);
const mockedAddMutation = vi.mocked(useAddCustomDomainMutation);
const mockedRemoveMutation = vi.mocked(useRemoveCustomDomainMutation);
const mockedVerifyMutation = vi.mocked(useVerifyCustomDomainMutation);
const mockedShowRetryableError = vi.mocked(showRetryableError);
const mockedCopy = vi.mocked(handleCopyText);

// `data` is the row (or null); the helper wraps it in the response envelope.
function setQuery(
  partial: Record<string, unknown>,
  envelope: Record<string, unknown> = {}
) {
  const { data, ...rest } = partial as { data?: unknown };
  mockedQuery.mockReturnValue({
    data:
      "data" in partial
        ? { custom_domain: data ?? null, ...envelope }
        : undefined,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...rest,
  } as never);
}

function setPreflight(data: unknown, extra: Record<string, unknown> = {}) {
  mockedPreflightQuery.mockReturnValue({
    data,
    isFetching: false,
    isLoading: false,
    ...extra,
  } as never);
}

function renderDialog(props: Record<string, unknown> = {}) {
  return render(
    <CustomDomainDialog
      projectId="p1"
      hasPaidPlan={true}
      open={true}
      onOpenChange={vi.fn()}
      onViewPlans={vi.fn()}
      iosIntegrated={false}
      androidIntegrated={false}
      {...props}
    />
  );
}

describe("CustomDomainDialog", () => {
  let addMutateAsync: ReturnType<typeof vi.fn>;
  let removeMutateAsync: ReturnType<typeof vi.fn>;
  let verifyMutateAsync: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    setPreflight(null);
    addMutateAsync = vi.fn().mockResolvedValue({ data: {} });
    removeMutateAsync = vi.fn().mockResolvedValue({ data: {} });
    verifyMutateAsync = vi.fn().mockResolvedValue({ data: {} });
    mockedAddMutation.mockReturnValue({
      mutateAsync: addMutateAsync,
      isPending: false,
    } as never);
    mockedRemoveMutation.mockReturnValue({
      mutateAsync: removeMutateAsync,
      isPending: false,
    } as never);
    mockedVerifyMutation.mockReturnValue({
      mutateAsync: verifyMutateAsync,
      isPending: false,
    } as never);
  });

  it("shows the upsell when there is no paid plan", () => {
    setQuery({ data: null });
    renderDialog({ hasPaidPlan: false });
    expect(screen.getByText(/requires a paid plan/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /view plans/i })
    ).toBeInTheDocument();
    // Does not show the setup input in the upsell state.
    expect(screen.queryByPlaceholderText("links.acme.com")).toBeNull();
  });

  it("calls onViewPlans when View plans is clicked in the upsell", () => {
    setQuery({ data: null });
    const onViewPlans = vi.fn();
    renderDialog({ hasPaidPlan: false, onViewPlans });
    fireEvent.click(screen.getByRole("button", { name: /view plans/i }));
    expect(onViewPlans).toHaveBeenCalled();
  });

  it("shows a loading skeleton while the plan is still loading", () => {
    setQuery({ data: null });
    renderDialog({ hasPaidPlan: false, planLoading: true });
    // Neither the upsell nor the setup input while the plan is unknown.
    expect(screen.queryByText(/requires a paid plan/i)).toBeNull();
    expect(screen.queryByPlaceholderText("links.acme.com")).toBeNull();
  });

  it("shows the input and add button in the None state with a paid plan", () => {
    setQuery({ data: null });
    renderDialog({ hasPaidPlan: true });
    expect(screen.getByPlaceholderText("links.acme.com")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add subdomain/i })
    ).toBeInTheDocument();
  });

  it("shows the exact cname_target once SSL is issued and ownership verified", () => {
    setQuery({
      data: {
        hostname: "links.acme.com",
        status: "pending",
        ssl_status: "active",
        cname_target: "uniq-target.cdn.example.net",
      },
    });
    renderDialog();
    expect(
      screen.getByText(/add this record at your dns provider/i)
    ).toBeInTheDocument();
    expect(screen.getByText("uniq-target.cdn.example.net")).toBeInTheDocument();
  });

  it("does not show the CNAME instructions before SSL is issued", () => {
    setQuery({
      data: {
        hostname: "links.acme.com",
        status: "pending",
        ssl_status: "pending_validation",
        cname_target: "uniq-target.cdn.example.net",
        ssl_validation_txt_records: [
          { name: "_acme-challenge.links.acme.com", value: "token-abc" },
        ],
      },
    });
    renderDialog();
    expect(screen.queryByText("uniq-target.cdn.example.net")).toBeNull();
  });

  it("copies the cname target when the Value copy button is clicked", () => {
    setQuery({
      data: {
        hostname: "links.acme.com",
        status: "pending",
        ssl_status: "active",
        cname_target: "uniq-target.cdn.example.net",
      },
    });
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /copy value/i }));
    expect(mockedCopy).toHaveBeenCalledWith("uniq-target.cdn.example.net");
  });

  it("copies the hostname when the Host copy button is clicked", () => {
    setQuery({
      data: {
        hostname: "links.acme.com",
        status: "pending",
        ssl_status: "active",
        cname_target: "uniq-target.cdn.example.net",
      },
    });
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /copy host/i }));
    expect(mockedCopy).toHaveBeenCalledWith("links.acme.com");
  });

  it("renders SSL validation TXT records in the Pending state", () => {
    setQuery({
      data: {
        hostname: "links.acme.com",
        status: "pending",
        ssl_status: "pending_validation",
        cname_target: "x.cdn.example",
        ssl_validation_txt_records: [
          { name: "_acme-challenge.links.acme.com", value: "token-abc" },
        ],
      },
    });
    renderDialog();
    expect(
      screen.getByText("_acme-challenge.links.acme.com")
    ).toBeInTheDocument();
    expect(screen.getByText("token-abc")).toBeInTheDocument();
  });

  it("renders every SSL validation TXT record when there are several", () => {
    setQuery({
      data: {
        hostname: "links.acme.com",
        status: "pending",
        ssl_status: "pending_validation",
        cname_target: "x.cdn.example",
        ssl_validation_txt_records: [
          { name: "_acme-challenge.links.acme.com", value: "token-one" },
          { name: "_acme-challenge.links.acme.com", value: "token-two" },
        ],
      },
    });
    renderDialog();
    expect(screen.getByText("token-one")).toBeInTheDocument();
    expect(screen.getByText("token-two")).toBeInTheDocument();
  });

  it("renders the ownership verification TXT record when present", () => {
    setQuery({
      data: {
        hostname: "links.acme.com",
        status: "pending",
        ssl_status: "pending_validation",
        cname_target: "x.cdn.example",
        ssl_validation_txt_records: [],
        ownership_verification_txt_name: "_cf-custom-hostname.links.acme.com",
        ownership_verification_txt_value: "ov-token-xyz",
      },
    });
    renderDialog();
    expect(
      screen.getByText("_cf-custom-hostname.links.acme.com")
    ).toBeInTheDocument();
    expect(screen.getByText("ov-token-xyz")).toBeInTheDocument();
  });

  it("shows the CNAME once SSL is issued even if ownership TXT is still outstanding", () => {
    // Zones already hosted on Cloudflare ("custom hostname does not CNAME to
    // this zone") can never satisfy the ownership TXT — activation happens
    // via the CNAME itself, so it must not be gated on ownership.
    setQuery({
      data: {
        hostname: "links.acme.com",
        status: "pending",
        ssl_status: "active",
        cname_target: "uniq-target.cdn.example.net",
        ssl_validation_txt_records: [],
        ownership_verification_txt_name: "_cf-custom-hostname.links.acme.com",
        ownership_verification_txt_value: "ov-token-xyz",
        verification_errors: "custom hostname does not CNAME to this zone.",
      },
    });
    renderDialog();
    // Both the outstanding ownership TXT and the CNAME instructions render.
    expect(screen.getByText("ov-token-xyz")).toBeInTheDocument();
    expect(screen.getByText("uniq-target.cdn.example.net")).toBeInTheDocument();
    expect(
      screen.getByText(/ownership completes once the cname below is in place/i)
    ).toBeInTheDocument();
  });

  it("suppresses Cloudflare's redundant 'point the CNAME' notices during setup", () => {
    setQuery({
      data: {
        hostname: "links.acme.com",
        status: "pending",
        ssl_status: "active",
        cname_target: "uniq-target.cdn.example.net",
        ssl_validation_txt_records: [],
        verification_errors:
          "custom hostname does not CNAME to this zone.; The hostname is using Cloudflare and cannot be activated with an TXT or HTTP validation token. To activate the custom hostname, the DNS target needs to point to the SaaS zone",
      },
    });
    renderDialog();
    expect(screen.queryByText(/does not CNAME to this zone/i)).toBeNull();
    expect(screen.queryByText(/validation token/i)).toBeNull();
    // The checklist's own CNAME instructions still render.
    expect(screen.getByText("uniq-target.cdn.example.net")).toBeInTheDocument();
  });

  it("keeps meaningful Cloudflare notices visible during setup", () => {
    setQuery({
      data: {
        hostname: "links.acme.com",
        status: "pending",
        ssl_status: "pending_validation",
        cname_target: "x.cdn.example",
        ssl_validation_txt_records: [
          { name: "_acme-challenge.links.acme.com", value: "token-abc" },
        ],
        verification_errors:
          "custom hostname does not CNAME to this zone.; caa_error: refused to issue for this domain",
      },
    });
    renderDialog();
    expect(
      screen.getByText(/caa_error: refused to issue for this domain/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/cloudflare reported/i)).toBeInTheDocument();
    expect(screen.queryByText(/does not CNAME to this zone/i)).toBeNull();
  });

  it("copies a TXT record value when its copy button is clicked", () => {
    setQuery({
      data: {
        hostname: "links.acme.com",
        status: "pending",
        ssl_status: "pending_validation",
        cname_target: "uniq-target.cdn.example.net",
        ssl_validation_txt_records: [
          { name: "_acme-challenge.links.acme.com", value: "token-abc" },
        ],
      },
    });
    renderDialog();
    // The CNAME block is gated until SSL issues, so the only Value copy
    // button belongs to the TXT record.
    fireEvent.click(screen.getByRole("button", { name: /copy value/i }));
    expect(mockedCopy).toHaveBeenCalledWith("token-abc");
  });

  it("shows a preparing placeholder while the SSL TXT challenge is empty", () => {
    setQuery({
      data: {
        hostname: "links.acme.com",
        status: "pending",
        ssl_status: "pending_validation",
        cname_target: "x.cdn.example",
        ssl_validation_txt_records: [],
      },
    });
    renderDialog();
    expect(
      screen.getByText(/preparing ssl validation txt/i)
    ).toBeInTheDocument();
  });

  it("hides TXT instructions once ssl is active and ownership is verified", () => {
    setQuery({
      data: {
        hostname: "links.acme.com",
        status: "pending",
        ssl_status: "active",
        cname_target: "x.cdn.example",
        ssl_validation_txt_records: [],
        ownership_verification_txt_name: null,
        ownership_verification_txt_value: null,
      },
    });
    renderDialog();
    expect(screen.queryByText(/preparing ssl validation txt/i)).toBeNull();
    expect(screen.queryByText(/validation txt/i)).toBeNull();
    // The CNAME instructions remain.
    expect(
      screen.getByText(/add this record at your dns provider/i)
    ).toBeInTheDocument();
  });

  it("treats provisioning like pending and shows DNS instructions", () => {
    setQuery({
      data: {
        hostname: "links.acme.com",
        status: "provisioning",
        ssl_status: "pending_validation",
        cname_target: "uniq-target.cdn.example.net",
        ssl_validation_txt_records: [
          { name: "_acme-challenge.links.acme.com", value: "token-abc" },
        ],
      },
    });
    renderDialog();
    expect(screen.getByText("token-abc")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("links.acme.com")).toBeNull();
  });

  it("keeps showing CNAME setup when active but DNS is not pointed yet", () => {
    setQuery({
      data: {
        hostname: "links.acme.com",
        status: "active",
        ssl_status: "active",
        cname_target: "uniq-target.cdn.example.net",
        ssl_validation_txt_records: [],
      },
    });
    setPreflight({
      hostname: "links.acme.com",
      cname_matches: false,
      cname_actual: "old-competitor.example.net",
    });
    renderDialog();
    expect(screen.getByText("uniq-target.cdn.example.net")).toBeInTheDocument();
    expect(
      screen.getByText(/currently points to old-competitor\.example\.net/i)
    ).toBeInTheDocument();
    // Not presented as live yet.
    expect(
      screen.queryByRole("link", { name: /links\.acme\.com/i })
    ).toBeNull();
  });

  it("shows the live state when active and the CNAME matches", () => {
    setQuery({
      data: {
        hostname: "links.acme.com",
        status: "active",
        ssl_status: "active",
        cname_target: "uniq-target.cdn.example.net",
        ssl_validation_txt_records: [],
      },
    });
    setPreflight({ hostname: "links.acme.com", cname_matches: true });
    renderDialog();
    const link = screen.getByRole("link", { name: /links\.acme\.com/i });
    expect(link).toHaveAttribute("href", "https://links.acme.com");
  });

  it("hides the iOS/Android setup actions while the domain is in DNS setup", () => {
    // The app setup pages only list the custom subdomain once it is active,
    // so mid-setup deep links would land on a page without the entry.
    window.localStorage.clear();
    setQuery({
      data: {
        hostname: "links.acme.com",
        status: "pending",
        ssl_status: "pending_validation",
        cname_target: "uniq-target.cdn.example.net",
        ssl_validation_txt_records: [],
      },
    });
    renderDialog({ iosIntegrated: true, androidIntegrated: true });
    expect(screen.queryByText("iOS app")).toBeNull();
    expect(screen.queryByText("Android app")).toBeNull();
  });

  it("shows the iOS/Android setup actions once the domain is live", () => {
    window.localStorage.clear();
    setQuery({
      data: {
        hostname: "links.acme.com",
        status: "active",
        ssl_status: "active",
        cname_target: "uniq-target.cdn.example.net",
        ssl_validation_txt_records: [],
      },
    });
    setPreflight({ hostname: "links.acme.com", cname_matches: true });
    renderDialog({ iosIntegrated: true, androidIntegrated: true });
    expect(screen.getByText("iOS app")).toBeInTheDocument();
    expect(screen.getByText("Android app")).toBeInTheDocument();
  });

  it("legacy payload (no TXT contract) still shows the CNAME instructions", () => {
    // Older backend deploys: no ssl_validation_txt_records key at all, no
    // ssl_status — the CNAME must render or setup is impossible.
    setQuery({
      data: {
        hostname: "links.acme.com",
        status: "pending",
        cname_target: "uniq-target.cdn.example.net",
      },
    });
    renderDialog();
    expect(
      screen.getByText(/add this record at your dns provider/i)
    ).toBeInTheDocument();
    expect(screen.getByText("uniq-target.cdn.example.net")).toBeInTheDocument();
    expect(screen.queryByText(/preparing ssl validation txt/i)).toBeNull();
  });

  it("shows the failure surface when SSL failed even though status is pending", () => {
    setQuery({
      data: {
        hostname: "links.acme.com",
        status: "pending",
        ssl_status: "failed",
        cname_target: "x.cdn.example",
        ssl_validation_txt_records: [],
        verification_errors: ["SSL did not issue"],
      },
    });
    renderDialog();
    expect(screen.getAllByText(/verification failed/i).length).toBeGreaterThan(
      0
    );
    expect(screen.getByText(/ssl did not issue/i)).toBeInTheDocument();
    expect(screen.queryByText(/preparing ssl validation txt/i)).toBeNull();
    expect(screen.queryByText(/checking dns/i)).toBeNull();
  });

  it("shows the removal notice for a suspended domain instead of the add form", () => {
    // Backend semantics: "suspended" means the row is mid-removal (held
    // suspended during the Cloudflare DELETE), not a verification failure.
    setQuery({
      data: {
        hostname: "links.acme.com",
        status: "suspended",
        ssl_status: "active",
        cname_target: "x.cdn.example",
        ssl_validation_txt_records: [],
      },
    });
    renderDialog();
    expect(
      screen.getAllByText(/this subdomain is being removed/i).length
    ).toBeGreaterThan(0);
    expect(screen.queryByText(/verification failed/i)).toBeNull();
    expect(screen.queryByPlaceholderText("links.acme.com")).toBeNull();
  });

  it("shows the deploying note for ssl_status pending_deployment, not the preparing placeholder", () => {
    setQuery({
      data: {
        hostname: "links.acme.com",
        status: "pending",
        ssl_status: "pending_deployment",
        cname_target: "x.cdn.example",
        ssl_validation_txt_records: [],
      },
    });
    renderDialog();
    expect(
      screen.getByText(/ssl validated — certificate deploying/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/preparing ssl validation txt/i)).toBeNull();
  });

  it("waits for the first preflight answer instead of flashing the live view", () => {
    setQuery({
      data: {
        hostname: "links.acme.com",
        status: "active",
        ssl_status: "active",
        cname_target: "x.cdn.example",
        ssl_validation_txt_records: [],
      },
    });
    setPreflight(undefined, { isLoading: true });
    renderDialog();
    expect(
      screen.queryByRole("link", { name: /links\.acme\.com/i })
    ).toBeNull();
    expect(
      screen.queryByText(/add this record at your dns provider/i)
    ).toBeNull();
  });

  it("keeps the live view when the preflight failure is a transient resolver error", () => {
    setQuery({
      data: {
        hostname: "links.acme.com",
        status: "active",
        ssl_status: "active",
        cname_target: "x.cdn.example",
        ssl_validation_txt_records: [],
      },
    });
    setPreflight({
      hostname: "links.acme.com",
      cname_matches: false,
      dns_error: "Resolv::ResolvTimeout",
    });
    renderDialog();
    expect(
      screen.getByRole("link", { name: /links\.acme\.com/i })
    ).toBeInTheDocument();
  });

  it("shows hostname as https link and Remove in the Active state", () => {
    setQuery({
      data: {
        hostname: "links.acme.com",
        status: "active",
        cname_target: "x.cdn.example",
      },
    });
    renderDialog();
    const link = screen.getByRole("link", { name: /links\.acme\.com/i });
    expect(link).toHaveAttribute("href", "https://links.acme.com");
    expect(screen.getByText("https://")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /remove/i })).toBeInTheDocument();
  });

  it("shows reason, Retry and Remove in the Failed state", () => {
    setQuery({
      data: {
        hostname: "links.acme.com",
        status: "failed",
        cname_target: "x.cdn.example",
        verification_errors: ["CNAME not found"],
      },
    });
    renderDialog();
    expect(screen.getAllByText(/verification failed/i).length).toBeGreaterThan(
      0
    );
    expect(screen.getByText(/cname not found/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /remove/i })).toBeInTheDocument();
  });

  it("renders verification_errors when the API returns a single string", () => {
    setQuery({
      data: {
        hostname: "links.acme.com",
        status: "pending",
        cname_target: "x.cdn.example",
        verification_errors: "CNAME record not found",
      },
    });
    renderDialog();
    expect(screen.getByText(/cname record not found/i)).toBeInTheDocument();
  });

  it("renders verification_errors when the API returns an object", () => {
    setQuery({
      data: {
        hostname: "links.acme.com",
        status: "failed",
        cname_target: "x.cdn.example",
        verification_errors: { cname: "points to the wrong target" },
      },
    });
    renderDialog();
    expect(screen.getByText(/points to the wrong target/i)).toBeInTheDocument();
  });

  it("shows an inline message on 422", async () => {
    setQuery({ data: null });
    addMutateAsync.mockRejectedValueOnce(
      new ApiError("invalid", 422, undefined, {
        message: "must be a subdomain, ASCII only",
      })
    );
    renderDialog();
    fireEvent.change(screen.getByPlaceholderText("links.acme.com"), {
      target: { value: "links.acme.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add subdomain/i }));
    expect(
      await screen.findByText(/must be a subdomain, ascii only/i)
    ).toBeInTheDocument();
  });

  it("submits the add mutation with hostname and purpose: primary", async () => {
    setQuery({ data: null });
    renderDialog();
    fireEvent.change(screen.getByPlaceholderText("links.acme.com"), {
      target: { value: "links.acme.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add subdomain/i }));
    await waitFor(() => expect(addMutateAsync).toHaveBeenCalled());
    expect(addMutateAsync).toHaveBeenCalledWith({
      hostname: "links.acme.com",
      purpose: "primary",
    });
  });

  it("submits the remove mutation with purpose: primary", async () => {
    setQuery({
      data: {
        hostname: "links.acme.com",
        status: "active",
        cname_target: "x.cdn.example",
      },
    });
    renderDialog();
    // Open the destructive confirm dialog, then click the confirm button.
    fireEvent.click(screen.getByRole("button", { name: /remove/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /yes, remove subdomain/i })
    );
    await waitFor(() => expect(removeMutateAsync).toHaveBeenCalled());
    expect(removeMutateAsync).toHaveBeenCalledWith("primary");
  });

  it("shows an inline upsell on 402 even with a (stale) paid plan", async () => {
    setQuery({ data: null });
    addMutateAsync.mockRejectedValueOnce(new ApiError("pay", 402));
    renderDialog({ hasPaidPlan: true });
    fireEvent.change(screen.getByPlaceholderText("links.acme.com"), {
      target: { value: "links.acme.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add subdomain/i }));
    expect(await screen.findByText(/paid plan/i)).toBeInTheDocument();
  });

  it("fires a retryable toast on 502", async () => {
    setQuery({ data: null });
    addMutateAsync.mockRejectedValueOnce(new ApiError("cf", 502));
    renderDialog();
    fireEvent.change(screen.getByPlaceholderText("links.acme.com"), {
      target: { value: "links.acme.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add subdomain/i }));
    await waitFor(() => expect(mockedShowRetryableError).toHaveBeenCalled());
  });

  it("reconciles on 409 by refetching", async () => {
    const refetch = vi.fn();
    setQuery({ data: null, refetch });
    addMutateAsync.mockRejectedValueOnce(
      new ApiError("conflict", 409, undefined, {
        message: "already configured",
      })
    );
    renderDialog();
    fireEvent.change(screen.getByPlaceholderText("links.acme.com"), {
      target: { value: "links.acme.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add subdomain/i }));
    expect(await screen.findByText(/already configured/i)).toBeInTheDocument();
    expect(refetch).toHaveBeenCalled();
  });

  describe("manual mode (self-hosted, no Cloudflare)", () => {
    const manualEnvelope = {
      tls_mode: "manual",
      ingress_host: "links.app.com",
    };

    const manualRow = {
      hostname: "links.acme.com",
      purpose: "primary",
      status: "pending",
      ssl_status: null,
      verification_errors: null,
      source: "enterprise",
      cname_target: "links.app.com",
      ssl_validation_txt_records: [],
      setup_records: [
        {
          kind: "certificate",
          type: null,
          name: null,
          value: null,
          note: "Issue a certificate covering links.acme.com and attach it to your load balancer's HTTPS listener.",
        },
        {
          kind: "dns",
          type: "CNAME",
          name: "links.acme.com",
          value: "links.app.com",
          note: "Add this only after the certificate is attached.",
        },
      ],
    };

    it("bypasses the paywall when the deployment is manual", () => {
      setQuery({ data: null }, manualEnvelope);
      renderDialog({ hasPaidPlan: false });
      expect(screen.queryByText(/requires a paid plan/i)).toBeNull();
      expect(screen.getByPlaceholderText("links.acme.com")).toBeInTheDocument();
    });

    it("holds a skeleton instead of flashing the upsell while the domain query loads", () => {
      setQuery({ isLoading: true });
      renderDialog({ hasPaidPlan: false });
      expect(screen.queryByText(/requires a paid plan/i)).toBeNull();
      expect(screen.queryByPlaceholderText("links.acme.com")).toBeNull();
    });

    it("renders the manual checklist with a Pending chip and Verify button for a pending row", () => {
      setQuery({ data: manualRow }, manualEnvelope);
      renderDialog();
      expect(
        screen.getByText(/issue a certificate covering/i)
      ).toBeInTheDocument();
      expect(screen.queryByText(/hostname ownership verified/i)).toBeNull();
      expect(screen.queryByText(/we re-check your dns/i)).toBeNull();
      expect(screen.getByText("Pending")).toBeInTheDocument();
      expect(screen.getByText(/activates automatically/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /verify now/i })
      ).toBeInTheDocument();
    });

    it("calls the verify mutation with the hostname", async () => {
      setQuery({ data: manualRow }, manualEnvelope);
      renderDialog();
      fireEvent.click(screen.getByRole("button", { name: /verify now/i }));
      await waitFor(() =>
        expect(verifyMutateAsync).toHaveBeenCalledWith("links.acme.com")
      );
    });

    it("shows a throttle notice when verify returns 429", async () => {
      setQuery({ data: manualRow }, manualEnvelope);
      verifyMutateAsync.mockRejectedValueOnce(new ApiError("throttled", 429));
      renderDialog();
      fireEvent.click(screen.getByRole("button", { name: /verify now/i }));
      expect(await screen.findByText(/too many attempts/i)).toBeInTheDocument();
    });

    it("renders the row's verification_errors verbatim", () => {
      setQuery(
        {
          data: {
            ...manualRow,
            verification_errors: ["No valid certificate for this host yet"],
          },
        },
        manualEnvelope
      );
      renderDialog();
      expect(
        screen.getByText("No valid certificate for this host yet")
      ).toBeInTheDocument();
    });

    it("treats active as authoritative even when preflight says the CNAME is not pointed", () => {
      setQuery({ data: { ...manualRow, status: "active" } }, manualEnvelope);
      setPreflight({ hostname: "links.acme.com", cname_matches: false });
      renderDialog();
      expect(screen.queryByText(/issue a certificate covering/i)).toBeNull();
      expect(
        screen.getByRole("link", { name: /links\.acme\.com/i })
      ).toBeInTheDocument();
    });

    it("does not promise included SSL in the manual add form", () => {
      setQuery({ data: null }, manualEnvelope);
      renderDialog();
      expect(screen.queryByText(/ssl is included/i)).toBeNull();
    });

    it("shows a generic retry message on 502, not a Cloudflare one", async () => {
      setQuery({ data: null }, manualEnvelope);
      addMutateAsync.mockRejectedValueOnce(new ApiError("bad gateway", 502));
      renderDialog();
      fireEvent.change(screen.getByPlaceholderText("links.acme.com"), {
        target: { value: "links.acme.com" },
      });
      fireEvent.click(screen.getByRole("button", { name: /add subdomain/i }));
      await waitFor(() => expect(mockedShowRetryableError).toHaveBeenCalled());
      expect(mockedShowRetryableError.mock.calls[0]?.[0]).not.toMatch(
        /cloudflare/i
      );
    });

    it("keeps an existing row manageable when ingress_host is null", () => {
      setQuery({ data: manualRow }, { tls_mode: "manual", ingress_host: null });
      renderDialog();
      expect(
        screen.getByText(/issue a certificate covering/i)
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /remove/i })
      ).toBeInTheDocument();
      expect(screen.queryByText(/contact your administrator/i)).toBeNull();
    });

    it("routes a failed manual row to the manual body with Verify, not Cloudflare Retry", () => {
      setQuery(
        {
          data: {
            ...manualRow,
            status: "failed",
            verification_errors: ["Host did not respond within 3s"],
          },
        },
        manualEnvelope
      );
      renderDialog();
      expect(
        screen.getByText(/issue a certificate covering/i)
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /verify now/i })
      ).toBeInTheDocument();
      expect(
        screen.getByText("Host did not respond within 3s")
      ).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^retry$/i })).toBeNull();
    });

    it("never promises included SSL while the dialog is still loading", () => {
      setQuery({ isLoading: true });
      renderDialog({ planLoading: true, hasPaidPlan: false });
      expect(screen.queryByText(/ssl is included/i)).toBeNull();
    });

    it("shows the administrator note when the deployment has no ingress host", () => {
      setQuery({ data: null }, { tls_mode: "manual", ingress_host: null });
      renderDialog();
      expect(
        screen.getByText(/contact your administrator/i)
      ).toBeInTheDocument();
      expect(screen.queryByPlaceholderText("links.acme.com")).toBeNull();
    });
  });
});
