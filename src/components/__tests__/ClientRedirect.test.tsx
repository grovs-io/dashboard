import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

const mockReplace = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
}));

vi.mock("@/context/useUserContext", () => ({
  useUserContext: () => ({ isHydrated: true }),
}));

vi.mock("@/lib/LocalStorage", () => ({
  default: {
    getAuthenticationToken: vi.fn(),
    setAuthenticationToken: vi.fn(),
    setRefreshToken: vi.fn(),
  },
}));

import ClientRedirect from "../auth/ClientRedirect";
import LocalStorage from "@/lib/LocalStorage";

describe("ClientRedirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    vi.mocked(LocalStorage.getAuthenticationToken).mockReturnValue(null);
  });

  it("stores SSO tokens and goes to the dashboard", async () => {
    mockSearchParams = new URLSearchParams("token=abc123&refresh_token=def456");
    vi.mocked(LocalStorage.getAuthenticationToken).mockReturnValue("abc123");

    render(<ClientRedirect />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/dashboard");
    });
    expect(LocalStorage.setAuthenticationToken).toHaveBeenCalledWith("abc123");
    expect(LocalStorage.setRefreshToken).toHaveBeenCalledWith("def456");
  });

  it("forwards an SSO error to the login page", async () => {
    mockSearchParams = new URLSearchParams(
      "error=No account exists for this email."
    );

    render(<ClientRedirect />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        "/login?error=No%20account%20exists%20for%20this%20email."
      );
    });
    expect(LocalStorage.setAuthenticationToken).not.toHaveBeenCalled();
  });

  it("goes to plain login when there is no session and no params", async () => {
    render(<ClientRedirect />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/login");
    });
  });
});
