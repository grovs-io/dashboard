import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

// The backend purges an uploaded image whenever generic_image_url is sent.
const domain = {
  subdomain: "acmeapp",
  domain: "grovs.link",
  generic_title: "Old",
  generic_subtitle: "Sub",
  generic_image_url: "https://cdn/uploaded.png",
};
const mutateAsync = vi.fn().mockResolvedValue({});

vi.mock("@/components/layout/app-header", () => ({ default: () => null }));
vi.mock("@/components/configuration/CustomDomainSetup", () => ({
  default: () => null,
}));
vi.mock("@/components/migration/MigrationEntry", () => ({
  default: () => null,
}));
vi.mock("@/components/common/delete-confirm", () => ({
  default: ({
    children,
    onConfirm,
  }: {
    children: React.ReactNode;
    onConfirm: () => void;
  }) => <div onClick={onConfirm}>{children}</div>,
}));
vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));
vi.mock("@/context/useProjectSelection", () => ({
  useProjectSelection: () => ({ selectedProject: { id: "p1" } }),
}));
vi.mock("@/hooks/queries/useConfigurationQueries", () => ({
  useDomainConfigQuery: () => ({ data: domain, isLoading: false }),
  useDomainDefaultsQuery: () => ({ data: undefined }),
  useCustomDomainQuery: () => ({ data: null, isLoading: false }),
}));
vi.mock("@/hooks/mutations/useConfigurationMutations", () => ({
  useSetSubdomainMutation: () => ({ mutateAsync }),
  useVerifySubdomainMutation: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ data: { available: true } }),
  }),
}));

import SocialMediaPreviewPage from "../social_media_preview/page";
import DomainPage from "../domain/page";

const sentForm = () => mutateAsync.mock.calls[0]![0] as FormData;

describe("domain settings saves don't re-send the existing image", () => {
  beforeEach(() => mutateAsync.mockClear());

  it("social preview: saving the title only omits generic_image_url", async () => {
    render(<SocialMediaPreviewPage />);
    fireEvent.change(
      screen.getByPlaceholderText("Enter a title for social sharing..."),
      { target: { value: "New title" } }
    );
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: /Save Changes/ }))
    );
    expect(sentForm().get("generic_title")).toBe("New title");
    expect(sentForm().has("generic_image_url")).toBe(false);
    expect(sentForm().has("generic_image")).toBe(false);
  });

  it("domain: changing the subdomain omits generic_image_url", async () => {
    render(<DomainPage />);
    fireEvent.change(screen.getByPlaceholderText("subdomain"), {
      target: { value: "acmeapp2" },
    });
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: /Save Changes/ }))
    );
    expect(sentForm().get("subdomain")).toBe("acmeapp2");
    expect(sentForm().get("generic_title")).toBe("Old");
    expect(sentForm().has("generic_image_url")).toBe(false);
  });
});
