import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/lib/edition", () => ({
  IS_ENTERPRISE: false,
  IS_SELF_HOSTED: true,
}));

import StartStep from "../steps/StartStep";

function setup(
  overrides: Partial<React.ComponentProps<typeof StartStep>> = {}
) {
  const onSubmit = vi.fn();
  const utils = render(<StartStep onSubmit={onSubmit} {...overrides} />);
  return { ...utils, onSubmit };
}

function chooseProvider(name: RegExp) {
  fireEvent.click(
    screen.getByRole("button", { name: /select source platform/i })
  );
  fireEvent.click(screen.getByRole("button", { name }));
}

function chooseProviderHosted() {
  fireEvent.click(screen.getByRole("radio", { name: /owns it/i }));
}

describe("StartStep provider-hosted mode (self-hosted build)", () => {
  it("hides the ownership picker until a provider is chosen", () => {
    setup();
    expect(screen.queryByText(/who owns the domain/i)).not.toBeInTheDocument();
  });

  it("shows the ownership picker defaulting to classic once a provider is chosen", () => {
    setup();
    chooseProvider(/branch/i);
    expect(screen.getByText(/who owns the domain/i)).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /i own the domain/i })
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByText(/must already run on a subdomain you own/i)
    ).toBeInTheDocument();
  });

  it("provider-hosted swaps DNS copy for the bridge note and shows extra hosts", () => {
    setup();
    chooseProvider(/branch/i);
    chooseProviderHosted();
    expect(
      screen.queryByText(/must already run on a subdomain you own/i)
    ).not.toBeInTheDocument();
    expect(screen.getByText(/transition bridge/i)).toBeInTheDocument();
    expect(screen.getByText(/extra hosts/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/branch domain/i)).toBeInTheDocument();
  });

  it("notifies the wizard when the mode changes", () => {
    const onProviderHostedChange = vi.fn();
    setup({ onProviderHostedChange });
    chooseProvider(/branch/i);
    chooseProviderHosted();
    expect(onProviderHostedChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole("radio", { name: /i own the domain/i }));
    expect(onProviderHostedChange).toHaveBeenLastCalledWith(false);
  });

  it("submits providerHosted + extraHosts", async () => {
    const { onSubmit } = setup();
    chooseProvider(/branch/i);
    chooseProviderHosted();
    fireEvent.change(screen.getByLabelText("Branch key"), {
      target: { value: "key_live_abc" },
    });
    fireEvent.change(screen.getByLabelText(/branch domain/i), {
      target: { value: "xyz.app.link" },
    });
    const chips = screen.getByPlaceholderText(/xyz-alternate\.app\.link/i);
    fireEvent.change(chips, { target: { value: "xyz-alternate.app.link" } });
    fireEvent.keyDown(chips, { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: /start migration/i }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        provider: "branch",
        hostname: "xyz.app.link",
        credentials: { branch_key: "key_live_abc" },
        providerHosted: true,
        extraHosts: ["xyz-alternate.app.link"],
      });
    });
  });

  it("classic submit still reports providerHosted false and no extras", async () => {
    const { onSubmit } = setup();
    chooseProvider(/branch/i);
    fireEvent.change(screen.getByLabelText("Branch key"), {
      target: { value: "key_live_abc" },
    });
    fireEvent.change(screen.getByLabelText(/branch subdomain/i), {
      target: { value: "old.acme.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /start migration/i }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        provider: "branch",
        hostname: "old.acme.com",
        credentials: { branch_key: "key_live_abc" },
        providerHosted: false,
        extraHosts: [],
      });
    });
  });

  it("renders a server extra-hosts error", () => {
    setup({
      extraHostsFieldError:
        "Extra hosts already in use by another migration source: a.app.link",
    });
    chooseProvider(/branch/i);
    chooseProviderHosted();
    expect(screen.getByText(/already in use/i)).toBeInTheDocument();
  });
});
