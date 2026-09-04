import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { ApiError } from "@/lib/ApiError";

vi.mock("@/lib/config", () => ({
  config: { docsUrl: "https://docs.example.com" },
}));

vi.mock("@/hooks/queries/useAuditQueries", () => ({
  useAuditExportTokensQuery: vi.fn(),
}));

vi.mock("@/hooks/mutations/useAuditMutations", () => ({
  useCreateAuditExportTokenMutation: vi.fn(),
  useRevokeAuditExportTokenMutation: vi.fn(),
}));

vi.mock("@/lib/Notifications", () => ({
  showSuccessNotification: vi.fn(),
  showErrorNotification: vi.fn(),
  showGenericError: vi.fn(),
}));

import { useAuditExportTokensQuery } from "@/hooks/queries/useAuditQueries";
import {
  useCreateAuditExportTokenMutation,
  useRevokeAuditExportTokenMutation,
} from "@/hooks/mutations/useAuditMutations";
import {
  showSuccessNotification,
  showErrorNotification,
} from "@/lib/Notifications";
import AuditExportTokensSheet from "../AuditExportTokensSheet";

const mockedTokensQuery = vi.mocked(useAuditExportTokensQuery);
const mockedCreate = vi.mocked(useCreateAuditExportTokenMutation);
const mockedRevoke = vi.mocked(useRevokeAuditExportTokenMutation);

const TOKENS = [
  {
    id: "t1",
    name: "Splunk",
    created_at: "2026-08-01T12:00:00Z",
    last_used_at: "2026-08-27T15:30:00Z",
    created_by_email: "admin@acme.com",
  },
  {
    id: "t2",
    name: "Datadog",
    created_at: "2026-08-05T10:00:00Z",
    last_used_at: null,
    created_by_email: null,
  },
];

describe("AuditExportTokensSheet", () => {
  let createMock: ReturnType<typeof vi.fn>;
  let revokeMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    createMock = vi.fn();
    revokeMock = vi.fn().mockResolvedValue({});
    mockedCreate.mockReturnValue({ mutateAsync: createMock } as never);
    mockedRevoke.mockReturnValue({ mutateAsync: revokeMock } as never);
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("shows skeleton while loading", () => {
    mockedTokensQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as never);
    render(
      <AuditExportTokensSheet instanceId="i1" open onOpenChange={() => {}} />
    );
    expect(screen.getByText("Export tokens")).toBeInTheDocument();
    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("shows the empty state with a docs link", () => {
    mockedTokensQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as never);
    render(
      <AuditExportTokensSheet instanceId="i1" open onOpenChange={() => {}} />
    );
    expect(screen.getByText("No export tokens")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /View integration guide/ })
    ).toHaveAttribute(
      "href",
      "https://docs.example.com/docs/audit-log/siem-integration"
    );
  });

  it("renders rows with name, creator, last used, and revoke", () => {
    mockedTokensQuery.mockReturnValue({
      data: TOKENS,
      isLoading: false,
      error: null,
    } as never);
    render(
      <AuditExportTokensSheet instanceId="i1" open onOpenChange={() => {}} />
    );
    expect(screen.getByText("Splunk")).toBeInTheDocument();
    expect(screen.getByText("Datadog")).toBeInTheDocument();
    expect(screen.getByText("admin@acme.com")).toBeInTheDocument();
    // Labelled rows rather than a run-on metadata line.
    expect(screen.getAllByText("Created by")).toHaveLength(2);
    expect(screen.getAllByText("Last used")).toHaveLength(2);
    expect(screen.getByText("Never")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Revoke/ })).toHaveLength(2);
  });

  it("puts Create token after the token list, not above it", () => {
    mockedTokensQuery.mockReturnValue({
      data: TOKENS,
      isLoading: false,
      error: null,
    } as never);
    render(
      <AuditExportTokensSheet instanceId="i1" open onOpenChange={() => {}} />
    );
    const create = screen.getByRole("button", { name: /Create token/ });
    const lastToken = screen.getByText("Datadog");
    expect(
      lastToken.compareDocumentPosition(create) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("renders a forbidden notice on 403", () => {
    mockedTokensQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new ApiError("Forbidden", 403),
    } as never);
    render(
      <AuditExportTokensSheet instanceId="i1" open onOpenChange={() => {}} />
    );
    expect(
      screen.getByText(/don't have access to export tokens/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Create token/ })
    ).not.toBeInTheDocument();
  });

  it("revokes after confirmation", async () => {
    mockedTokensQuery.mockReturnValue({
      data: [TOKENS[0]],
      isLoading: false,
      error: null,
    } as never);
    render(
      <AuditExportTokensSheet instanceId="i1" open onOpenChange={() => {}} />
    );

    fireEvent.click(screen.getByRole("button", { name: /Revoke/ }));
    await waitFor(() =>
      expect(screen.getByText("Revoke token?")).toBeInTheDocument()
    );
    const confirm = screen
      .getAllByRole("button", { name: /Revoke/ })
      .find((b) => b.closest("[role='dialog']") !== null);
    fireEvent.click(confirm!);

    await waitFor(() => expect(revokeMock).toHaveBeenCalledWith("t1"));
    expect(showSuccessNotification).toHaveBeenCalledWith("Token revoked");
  });

  it("shows an error toast when revoke fails", async () => {
    mockedTokensQuery.mockReturnValue({
      data: [TOKENS[0]],
      isLoading: false,
      error: null,
    } as never);
    revokeMock.mockRejectedValueOnce(new Error("nope"));
    render(
      <AuditExportTokensSheet instanceId="i1" open onOpenChange={() => {}} />
    );

    fireEvent.click(screen.getByRole("button", { name: /Revoke/ }));
    await waitFor(() =>
      expect(screen.getByText("Revoke token?")).toBeInTheDocument()
    );
    const confirm = screen
      .getAllByRole("button", { name: /Revoke/ })
      .find((b) => b.closest("[role='dialog']") !== null);
    fireEvent.click(confirm!);

    await waitFor(() =>
      expect(showErrorNotification).toHaveBeenCalledWith(
        "Failed to revoke token"
      )
    );
  });

  it("creates a token, reveals it once, copies it, and clears on close", async () => {
    mockedTokensQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as never);
    createMock.mockResolvedValueOnce({
      data: {
        audit_export_token: TOKENS[0],
        token: "aet_plain_secret",
      },
    });
    render(
      <AuditExportTokensSheet instanceId="i1" open onOpenChange={() => {}} />
    );

    fireEvent.click(screen.getByRole("button", { name: /Create token/ }));
    const nameInput = await screen.findByLabelText("Name");
    const submit = screen.getByRole("button", { name: "Create" });
    expect(submit).toBeDisabled();

    fireEvent.change(nameInput, { target: { value: "Splunk" } });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    await waitFor(() =>
      expect(screen.getByText("Copy your token")).toBeInTheDocument()
    );
    expect(createMock).toHaveBeenCalledWith({ name: "Splunk" });
    expect(screen.getByDisplayValue("aet_plain_secret")).toBeInTheDocument();
    expect(showSuccessNotification).toHaveBeenCalledWith("Token created");

    fireEvent.click(screen.getByRole("button", { name: /Copy/ }));
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "aet_plain_secret"
      )
    );
    expect(showSuccessNotification).toHaveBeenCalledWith("Copied");

    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() =>
      expect(
        screen.queryByDisplayValue("aet_plain_secret")
      ).not.toBeInTheDocument()
    );
  });

  it("shows an error toast when copy fails and keeps the token displayed", async () => {
    mockedTokensQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as never);
    createMock.mockResolvedValueOnce({
      data: {
        audit_export_token: TOKENS[0],
        token: "aet_plain_secret",
      },
    });
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error("denied")),
      },
    });
    render(
      <AuditExportTokensSheet instanceId="i1" open onOpenChange={() => {}} />
    );

    fireEvent.click(screen.getByRole("button", { name: /Create token/ }));
    const nameInput = await screen.findByLabelText("Name");
    fireEvent.change(nameInput, { target: { value: "Splunk" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(screen.getByText("Copy your token")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: /Copy/ }));
    await waitFor(() =>
      expect(showErrorNotification).toHaveBeenCalledWith(
        "Couldn't copy — select the token and copy it manually"
      )
    );
    expect(screen.getByDisplayValue("aet_plain_secret")).toBeInTheDocument();
  });

  it("ignores Escape while a create is pending and reveals the token when it resolves", async () => {
    mockedTokensQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as never);
    let resolveCreate!: (v: unknown) => void;
    createMock.mockReturnValueOnce(
      new Promise((r) => {
        resolveCreate = r;
      })
    );
    render(
      <AuditExportTokensSheet instanceId="i1" open onOpenChange={() => {}} />
    );

    fireEvent.click(screen.getByRole("button", { name: /Create token/ }));
    fireEvent.change(await screen.findByLabelText("Name"), {
      target: { value: "Splunk" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await act(async () => {
      resolveCreate({
        data: { audit_export_token: TOKENS[0], token: "aet_late" },
      });
    });
    expect(await screen.findByText("Copy your token")).toBeInTheDocument();
    expect(screen.getByDisplayValue("aet_late")).toBeInTheDocument();
  });

  it("shows an error toast when create fails", async () => {
    mockedTokensQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as never);
    createMock.mockRejectedValueOnce(new Error("nope"));
    render(
      <AuditExportTokensSheet instanceId="i1" open onOpenChange={() => {}} />
    );

    fireEvent.click(screen.getByRole("button", { name: /Create token/ }));
    fireEvent.change(await screen.findByLabelText("Name"), {
      target: { value: "Splunk" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(showErrorNotification).toHaveBeenCalledWith(
        "Failed to create token"
      )
    );
  });
});
