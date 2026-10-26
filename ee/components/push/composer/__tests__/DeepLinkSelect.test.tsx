import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { GET, POST } from "@/lib/api";
import DeepLinkSelect from "../DeepLinkSelect";
import { ok, polyfillDom, wrap } from "./helpers";

vi.mock("@/lib/api", () => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PATCH: vi.fn(),
  DELETE: vi.fn(),
}));
vi.mock("@/lib/config", () => ({ config: { apiPath: "/api/v1" } }));

const link = (id: number, name: string, path: string) => ({
  id,
  name,
  path,
  active: true,
});

beforeEach(() => {
  vi.clearAllMocks();
  polyfillDom();
  vi.mocked(GET).mockImplementation(async (path: string) =>
    ok({
      links: path.includes("term=spr")
        ? [link(4821, "Spring sale", "spring")]
        : [link(1, "Home", "home"), link(4821, "Spring sale", "spring")],
    })
  );
  vi.mocked(POST).mockResolvedValue(
    ok({ links: [link(77, "Old promo", "old")] })
  );
});

describe("DeepLinkSelect", () => {
  it("searches the lookup endpoint by term, with no date params, and stores the numeric id", async () => {
    const onChange = vi.fn();
    wrap(<DeepLinkSelect projectId="p1" value={null} onChange={onChange} />);
    await userEvent.click(screen.getByRole("combobox", { name: "Deep link" }));
    await screen.findByText("Home");
    expect(GET).toHaveBeenCalledWith(
      "/api/v1/projects/p1/links/lookup?limit=20",
      {
        signal: expect.any(AbortSignal),
      }
    );

    await userEvent.type(screen.getByPlaceholderText("Search links…"), "spr");
    await waitFor(() =>
      expect(GET).toHaveBeenCalledWith(
        "/api/v1/projects/p1/links/lookup?term=spr&limit=20",
        { signal: expect.any(AbortSignal) }
      )
    );
    for (const [path] of vi.mocked(GET).mock.calls)
      expect(path).not.toMatch(/date/);
    await waitFor(() =>
      expect(screen.queryByText("Home")).not.toBeInTheDocument()
    );

    await userEvent.click(screen.getByText("Spring sale"));
    expect(onChange).toHaveBeenCalledWith(4821);
  });

  it("shows a preselected link's name even when it is not in the lookup results", async () => {
    wrap(<DeepLinkSelect projectId="p1" value={77} onChange={vi.fn()} />);
    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: "Deep link" })
      ).toHaveTextContent("Old promo")
    );
    expect(POST).toHaveBeenCalledWith("/api/v1/projects/p1/links/by_ids", {
      ids: ["77"],
    });
  });

  it("offers a No link option that clears the selection", async () => {
    const onChange = vi.fn();
    wrap(<DeepLinkSelect projectId="p1" value={4821} onChange={onChange} />);
    await userEvent.click(screen.getByRole("combobox", { name: "Deep link" }));
    await userEvent.click(
      await screen.findByRole("option", { name: /No link/ })
    );
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("tells same-named links apart by their numeric id", async () => {
    vi.mocked(GET).mockResolvedValue(
      ok({ links: [link(1, "Promo", "promo-a"), link(2, "Promo", "promo-b")] })
    );
    vi.mocked(POST).mockResolvedValue(
      ok({ links: [link(2, "Promo", "promo-b")] })
    );
    const onChange = vi.fn();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { rerender } = render(
      <QueryClientProvider client={client}>
        <DeepLinkSelect projectId="p1" value={null} onChange={onChange} />
      </QueryClientProvider>
    );
    await userEvent.click(screen.getByRole("combobox", { name: "Deep link" }));
    await userEvent.click(await screen.findByText("promo-b"));
    expect(onChange).toHaveBeenCalledWith(2);
    expect(onChange).toHaveBeenCalledTimes(1);

    rerender(
      <QueryClientProvider client={client}>
        <DeepLinkSelect projectId="p1" value={2} onChange={onChange} />
      </QueryClientProvider>
    );
    await userEvent.click(screen.getByRole("combobox", { name: "Deep link" }));
    const options = await screen.findAllByRole("option");
    const a = options.find((o) => o.textContent?.includes("promo-a"))!;
    const b = options.find((o) => o.textContent?.includes("promo-b"))!;
    expect(a.querySelector("svg")).toHaveClass("opacity-0");
    expect(b.querySelector("svg")).toHaveClass("opacity-100");
  });
});
