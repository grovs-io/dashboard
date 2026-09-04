import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { SsoConnection } from "@/types";

vi.mock("@/lib/edition", () => ({
  IS_SELF_HOSTED: false,
  IS_ENTERPRISE: true,
}));
vi.mock("@/lib/Notifications", () => ({
  showErrorNotification: vi.fn(),
  showSuccessNotification: vi.fn(),
}));

const mocks = vi.hoisted(() => ({
  query: { data: null as SsoConnection | null, isPending: false },
  upsert: { mutateAsync: vi.fn(), isPending: false },
  createToken: { mutateAsync: vi.fn(), isPending: false },
  mutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/queries/useSsoQueries", () => ({
  useSsoConnectionQuery: () => mocks.query,
}));
vi.mock("@/hooks/mutations/useSsoMutations", () => ({
  useUpsertSsoConnectionMutation: () => mocks.upsert,
  useDeleteSsoConnectionMutation: mocks.mutation,
  useVerifySsoDomainsMutation: mocks.mutation,
  useCreateScimTokenMutation: () => mocks.createToken,
  useDeleteScimTokenMutation: mocks.mutation,
}));

import SsoSection from "../SsoSection";

const connection = (overrides: Partial<SsoConnection> = {}): SsoConnection => ({
  id: 12,
  issuer: "https://login.microsoftonline.com/t/v2.0",
  client_id: "cid",
  client_secret_set: true,
  client_secret_expires_at: null,
  client_secret_expires_soon: false,
  domains: [
    {
      domain: "uhc.com",
      verified_at: null,
      record_name: "_grovs-sso.uhc.com",
      record_value: "grovs-sso-verification=x",
    },
  ],
  enforce: false,
  jit_provision: true,
  admin_claim_value: null,
  scim: {
    enabled: false,
    base_url: "https://api.example.com/scim/v2",
    token_set: false,
    last_used_at: null,
  },
  enabled: true,
  active: false,
  redirect_uri:
    "https://api.example.com/api/v1/identity/sso/auth/oidc/callback",
  created_at: "",
  updated_at: "",
  ...overrides,
});

describe("SsoSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.query.data = null;
    mocks.query.isPending = false;
  });

  it("offers setup when no connection exists", () => {
    render(<SsoSection instanceId="i1" />);
    expect(screen.getByText("Set up")).toBeInTheDocument();
    expect(
      screen.queryByText("Require single sign-on")
    ).not.toBeInTheDocument();
  });

  it("keeps enforcement disabled until a domain is verified", () => {
    mocks.query.data = connection();
    render(<SsoSection instanceId="i1" />);
    expect(screen.getByRole("switch")).toBeDisabled();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Verify")).toBeInTheDocument();
  });

  it("asks for confirmation before enforcing on an active connection", () => {
    mocks.query.data = connection({
      active: true,
      domains: [
        {
          domain: "uhc.com",
          verified_at: "2026-09-03T00:00:00Z",
          record_name: "n",
          record_value: "v",
        },
      ],
    });
    render(<SsoSection instanceId="i1" />);
    const toggle = screen.getByRole("switch");
    expect(toggle).toBeEnabled();
    fireEvent.click(toggle);
    expect(
      screen.getByText("Require single sign-on for these domains?")
    ).toBeInTheDocument();
    expect(mocks.upsert.mutateAsync).not.toHaveBeenCalled();
  });

  it("adds domains through a dialog and removes only after two confirmations", async () => {
    mocks.query.data = connection();
    mocks.upsert.mutateAsync.mockResolvedValue({
      data: { sso_connection: connection() },
    });
    render(<SsoSection instanceId="i1" />);

    fireEvent.click(screen.getByText("Add domain"));
    fireEvent.change(screen.getByLabelText("Domains"), {
      target: { value: "Optum.com, uhc.com\nnot a domain" },
    });
    expect(screen.getByText("already added")).toBeInTheDocument();
    expect(screen.getAllByText("not a domain").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /^Add domain$/ })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Domains"), {
      target: { value: "Optum.com, uhc.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Add domain$/ }));
    await waitFor(() =>
      expect(mocks.upsert.mutateAsync).toHaveBeenCalledWith({
        domains: ["uhc.com", "optum.com"],
      })
    );

    fireEvent.click(screen.getByLabelText("Remove uhc.com"));
    expect(screen.getByText("Remove uhc.com?")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Continue"));
    const confirm = screen.getByRole("button", { name: "Remove domain" });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Domain"), {
      target: { value: "uhc.com" },
    });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(mocks.upsert.mutateAsync).toHaveBeenCalledWith({ domains: [] })
    );
  });

  it("reports SCIM as waiting until the identity provider calls in", () => {
    mocks.query.data = connection({
      scim: {
        enabled: true,
        base_url: "u",
        token_set: true,
        last_used_at: null,
      },
    });
    const { unmount } = render(<SsoSection instanceId="i1" />);
    expect(
      screen.getByText("Waiting for your identity provider")
    ).toBeInTheDocument();
    unmount();
    mocks.query.data = connection({
      scim: {
        enabled: true,
        base_url: "u",
        token_set: true,
        last_used_at: new Date().toISOString(),
      },
    });
    render(<SsoSection instanceId="i1" />);
    expect(
      screen.getByText("SCIM provisioning is connected")
    ).toBeInTheDocument();
    expect(screen.getByText(/Last contact just now/)).toBeInTheDocument();
  });

  it("edit dialog hides domains, keeps the secret, and saves only what changed", async () => {
    mocks.query.data = connection();
    mocks.upsert.mutateAsync.mockResolvedValue({
      data: { sso_connection: connection() },
    });
    render(<SsoSection instanceId="i1" />);
    fireEvent.click(screen.getByText("Edit"));

    expect(screen.queryByLabelText("Email domains")).not.toBeInTheDocument();
    expect(screen.getByText("Replace")).toBeInTheDocument();
    const save = screen.getByRole("button", { name: "Save changes" });
    expect(save).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Admin role value (optional)"), {
      target: { value: "grovs-admin" },
    });
    expect(save).toBeEnabled();
    fireEvent.click(save);
    await waitFor(() =>
      expect(mocks.upsert.mutateAsync).toHaveBeenCalledWith({
        admin_claim_value: "grovs-admin",
      })
    );
  });

  it("shows the SCIM token once after generating it", async () => {
    mocks.query.data = connection({ active: true });
    mocks.createToken.mutateAsync.mockResolvedValue({
      data: { token: "scim_secret" },
    });
    render(<SsoSection instanceId="i1" />);
    fireEvent.click(screen.getByText("Generate token"));
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    await waitFor(() =>
      expect(screen.getByDisplayValue("scim_secret")).toBeInTheDocument()
    );
    expect(screen.getByText("Copy your SCIM token")).toBeInTheDocument();
  });
});
