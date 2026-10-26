import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GET } from "@/lib/api";
import IdentifierListPreview from "../IdentifierListPreview";

vi.mock("@/lib/api", () => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PATCH: vi.fn(),
  DELETE: vi.fn(),
}));
vi.mock("@/lib/config", () => ({ config: { apiPath: "/api/v1" } }));
vi.mock("@/lib/Notifications", () => ({ showErrorNotification: vi.fn() }));

const ok = (data: unknown) => ({ data }) as never;

function renderPreview(total = 250) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <IdentifierListPreview projectId="p1" segmentId="s1" total={total} />
    </QueryClientProvider>
  );
}

describe("IdentifierListPreview", () => {
  beforeEach(() => vi.mocked(GET).mockReset());
  afterEach(() => {
    vi.restoreAllMocks();
    for (const [url] of vi.mocked(GET).mock.calls)
      expect(url).toMatch(
        /^\/api\/v1\/projects\/p1\/segments\/s1\/identifier_list/
      );
  });

  it("lists the uploaded identifiers and says when only the first 100 show", async () => {
    vi.mocked(GET).mockResolvedValue(
      ok({ identifiers: ["ana@x.io", "bob@x.io"], more: true })
    );
    renderPreview();
    expect(await screen.findByText("ana@x.io")).toBeInTheDocument();
    expect(screen.getByText("bob@x.io")).toBeInTheDocument();
    expect(
      screen.getByText(/Showing the first 100 of 250/)
    ).toBeInTheDocument();
    expect(GET).toHaveBeenCalledWith(
      "/api/v1/projects/p1/segments/s1/identifier_list",
      expect.anything()
    );
  });

  it("searches on the server and reports no matches", async () => {
    vi.mocked(GET).mockImplementation(async (url) =>
      String(url).includes("q=zz")
        ? ok({ identifiers: [], more: false })
        : ok({ identifiers: ["ana@x.io"], more: false })
    );
    renderPreview(1);
    expect(await screen.findByText("1 identifier")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Search identifiers"), "zz");
    expect(
      await screen.findByText('No identifiers match "zz".')
    ).toBeInTheDocument();
    expect(GET).toHaveBeenCalledWith(
      "/api/v1/projects/p1/segments/s1/identifier_list?q=zz",
      expect.anything()
    );
  });

  it("downloads the full list as a CSV file", async () => {
    vi.mocked(GET).mockImplementation(async (url) =>
      String(url).endsWith("/download")
        ? ok("identifier\nana@x.io\n")
        : ok({ identifiers: ["ana@x.io"], more: false })
    );
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:1");
    const revokeObjectURL = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    renderPreview(1);
    await userEvent.click(
      await screen.findByRole("button", { name: /Download CSV/ })
    );
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(GET).toHaveBeenCalledWith(
      "/api/v1/projects/p1/segments/s1/identifier_list/download",
      expect.anything()
    );
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:1");
  });
});
