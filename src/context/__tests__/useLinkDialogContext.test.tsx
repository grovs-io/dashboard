import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Link } from "@/types";
import LinkDialogProvider, {
  useGlobalLinkDialog,
} from "../useLinkDialogContext";

const created = {
  id: 4821,
  name: "Spring sale",
  path: "spring",
  active: true,
} as unknown as Link;
const createLink = vi.hoisted(() => vi.fn());

vi.mock("@/analytics", () => ({
  trackEvent: vi.fn(),
  EVENTS: { LINK_CREATED: "link" },
}));
vi.mock("@/lib/Notifications", () => ({
  showErrorNotification: vi.fn(),
  showSuccessNotification: vi.fn(),
}));
vi.mock("../useProjectSelection", () => ({
  useProjectSelection: () => ({
    selectedProject: { id: "p1", name: "Shop", domain: "shop.sqd.link" },
    selectedInstance: { id: "i1" },
  }),
}));
vi.mock("@/hooks/queries/useConfigurationQueries", () => ({
  useRedirectConfigQuery: () => ({
    data: { default_fallback: "https://shop.test" },
  }),
  useCustomDomainQuery: () => ({ data: null }),
}));
vi.mock("@/hooks/queries/useLinksQueries", () => ({
  useRandomPathQuery: () => ({ data: undefined }),
  usePathAvailableQuery: () => ({ data: undefined }),
}));
vi.mock("@/hooks/mutations/useLinksMutations", () => ({
  useCreateLinkMutation: () => ({ mutateAsync: createLink, isPending: false }),
  useUpdateLinkMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRemoveLinkMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/lib/buildLinkFormData", () => ({
  buildLinkFormData: () => new FormData(),
}));
vi.mock("@/hooks/useCreateLinkForm", () => ({
  useCreateLinkForm: () => ({
    sections: [],
    section: "details",
    setSection: vi.fn(),
    handleCloseWindow: vi.fn(),
    hasChanges: () => false,
    hasDuplicateKeys: () => false,
    disabledCreateButton: () => false,
    getFirstErrorSection: () => "details",
    initializeFromLink: vi.fn(),
    setPath: vi.fn(),
    setPathAvailable: vi.fn(),
    path: "",
    keyValuePair: [],
  }),
}));
vi.mock(
  "@/components/dynamic_links/links/create_link/LinkDialogContent",
  () => ({
    default: () => null,
  })
);
vi.mock(
  "@/components/dynamic_links/links/create_link/CreateLinkCreatedSuccessfully",
  () => ({
    default: () => <p>Success screen</p>,
  })
);
vi.mock("@/components/dynamic_links/links/RedirectPreviewModal", () => ({
  default: () => null,
}));
vi.mock("@/components/common/redirect-rules-gate-dialog", () => ({
  default: () => null,
}));

function Opener({ onSuccess }: { onSuccess: (link?: Link) => void }) {
  const { openLinkDialog } = useGlobalLinkDialog();
  return (
    <button type="button" onClick={() => openLinkDialog({ onSuccess })}>
      open
    </button>
  );
}

const renderWith = (onSuccess: (link?: Link) => void) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <LinkDialogProvider>
        <Opener onSuccess={onSuccess} />
      </LinkDialogProvider>
    </QueryClientProvider>
  );

beforeEach(() => {
  vi.clearAllMocks();
  createLink.mockResolvedValue({ data: { link: created } });
});

describe("LinkDialogProvider", () => {
  it("hands the created link to onSuccess", async () => {
    const onSuccess = vi.fn();
    renderWith(onSuccess);
    await userEvent.click(screen.getByRole("button", { name: "open" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Create" })
    );
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(created));
  });

  it("still works with an onSuccess that takes no argument", async () => {
    let calls = 0;
    renderWith(() => {
      calls += 1;
    });
    await userEvent.click(screen.getByRole("button", { name: "open" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Create" })
    );
    expect(await screen.findByText("Success screen")).toBeInTheDocument();
    expect(calls).toBe(1);
  });
});
