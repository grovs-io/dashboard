import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GET, POST } from "@/lib/api";
import { soundLabel } from "@ee/lib/push";
import ContentSummary from "../ContentSummary";
import { draftCampaign, ok, wrap } from "../composer/__tests__/helpers";

const linkDialog = vi.hoisted(() => ({
  openLinkDialog: vi.fn(),
  openEditLinkDialog: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PATCH: vi.fn(),
  DELETE: vi.fn(),
}));
vi.mock("@/lib/config", () => ({ config: { apiPath: "/api/v1" } }));
vi.mock("@/context/useLinkDialogContext", () => ({
  useGlobalLinkDialog: () => linkDialog,
}));
vi.mock("@/context/useProjectSelection", () => ({
  useProjectSelection: () => ({
    selectedProject: { id: "p1", name: "Acme Shop" },
  }),
}));

const LINK = {
  id: 4821,
  name: "Spring sale",
  path: "spring",
  access_path: "https://acme.sqd.link/spring",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(GET).mockResolvedValue(
    ok({
      segments: [{ id: "seg-1", name: "Active iOS buyers" }],
      truncated: false,
    })
  );
  vi.mocked(POST).mockResolvedValue(ok({ links: [LINK] }));
});

describe("ContentSummary", () => {
  it("lists every variant, marks the one sent to the rest, and previews the chosen one", async () => {
    wrap(
      <ContentSummary
        projectId="p1"
        campaign={draftCampaign({
          title: "Spring is here",
          body: "Open the app",
          variants: [{ id: "b", title: "Hi there", body: "Sale on" }],
          winner: "b",
        })}
      />
    );
    // One card holds the list and the preview.
    expect(screen.queryByRole("region", { name: "Variants" })).toBeNull();
    const card = screen.getByRole("region", { name: "Notification" });
    const rows = within(card).getAllByRole("radio");
    expect(rows.map((r) => r.textContent)).toEqual([
      "AYour messageSpring is hereOpen the app",
      "BVariant Bsent to the restHi thereSale on",
    ]);
    expect(rows[0]).toHaveAttribute("aria-checked", "true");
    expect(within(card).getAllByText("sent to the rest")).toHaveLength(1);
    expect(within(card).getByTestId("push-preview")).toHaveTextContent(
      "Spring is here"
    );
    await userEvent.click(rows[1]!);
    expect(rows[1]).toHaveAttribute("aria-checked", "true");
    expect(within(card).getByTestId("push-preview")).toHaveTextContent(
      "Hi there"
    );
    expect(within(card).getByTestId("push-preview")).toHaveTextContent(
      "Sale on"
    );
  });

  it("shows the preview alone without variants", () => {
    wrap(<ContentSummary projectId="p1" campaign={draftCampaign()} />);
    expect(screen.queryByRole("radiogroup", { name: "Variant" })).toBeNull();
    expect(screen.getByTestId("push-preview")).toHaveTextContent(
      "Spring is here"
    );
  });

  it("opens the link dialog on the linked link and shows its URL", async () => {
    wrap(
      <ContentSummary
        projectId="p1"
        campaign={draftCampaign({ link_id: 4821 })}
      />
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Spring sale" })
    );
    expect(linkDialog.openEditLinkDialog).toHaveBeenCalledWith(
      expect.objectContaining({ id: 4821 }),
      {}
    );
    expect(
      screen.getByText("https://acme.sqd.link/spring")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy link URL" })
    ).toBeInTheDocument();
  });

  it("links a segment audience to its segment page", async () => {
    wrap(
      <ContentSummary
        projectId="p1"
        campaign={draftCampaign({
          audience: {
            type: "segment",
            recipients_count: 0,
            recipients: [],
            segment_id: "seg-1",
            segment_definition_hash: "h",
          },
        })}
      />
    );
    const link = await screen.findByRole("link", {
      name: "Segment: Active iOS buyers",
    });
    expect(link).toHaveAttribute("href", "/segments/seg-1");
  });

  it("labels the sound and shows the preview with the project name", () => {
    expect(soundLabel("default")).toBe("Default");
    expect(soundLabel(null)).toBe("Silent");
    expect(soundLabel("")).toBe("Silent");
    expect(soundLabel("chime.caf")).toBe("chime.caf");
    wrap(
      <ContentSummary
        projectId="p1"
        campaign={draftCampaign({ sound: "chime.caf" })}
      />
    );
    expect(screen.getByText("chime.caf")).toBeInTheDocument();
    expect(screen.getByText("Acme Shop")).toBeInTheDocument();
    expect(screen.getByText("No link")).toBeInTheDocument();
  });

  it("shows the schedule in the campaign's zone, date and time together", () => {
    wrap(
      <ContentSummary
        projectId="p1"
        campaign={draftCampaign({
          scheduled_at: "2026-03-08T03:30:00Z",
          timezone: "America/New_York",
        })}
      />
    );
    expect(
      screen.getByText("Sat, 7 Mar 2026 at 22:30 EST")
    ).toBeInTheDocument();
  });

  it("shows a local-time schedule as each user's wall clock", () => {
    wrap(
      <ContentSummary
        projectId="p1"
        campaign={draftCampaign({
          scheduled_at: "2026-03-09T13:00:00Z",
          local_time: true,
          timezone: "America/New_York",
        })}
      />
    );
    expect(
      screen.getByText("Mon, 9 Mar 2026 at 09:00 in each user's local time")
    ).toBeInTheDocument();
  });
});
