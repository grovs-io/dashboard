import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const m = vi.hoisted(() => ({
  selfHosted: false,
  mutateAsync: vi.fn(),
}));

vi.mock("@/lib/edition", () => ({
  IS_ENTERPRISE: false,
  get IS_SELF_HOSTED() {
    return m.selfHosted;
  },
}));
vi.mock("@/hooks/mutations/useInstanceMutations", () => ({
  useAddMemberMutation: () => ({
    mutateAsync: m.mutateAsync,
    isPending: false,
  }),
}));
vi.mock("@/hooks/queries/useInstanceQueries", () => ({
  useInstanceMembersQuery: () => ({ data: { members: [] } }),
}));
vi.mock("@/context/useUserContext", () => ({
  useUserContext: () => ({ user: { email: "me@segments.io" } }),
}));

import { SendToDeveloperDialog } from "../SendToDeveloperDialog";

const sendInvite = async () => {
  render(
    <SendToDeveloperDialog
      open
      onOpenChange={() => {}}
      instanceId="i1"
      link="https://app.test/setup"
    />
  );
  fireEvent.change(screen.getByLabelText("Their email"), {
    target: { value: "dev@segments.io" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send invite" }));
  await screen.findByText("Link to this step");
};

beforeEach(() => {
  m.selfHosted = false;
  m.mutateAsync.mockResolvedValue({
    data: { invite_url: "https://app.test/invite/abc" },
  });
});

describe("SendToDeveloperDialog", () => {
  it("says the invite was emailed on cloud", async () => {
    await sendInvite();
    expect(screen.getByText(/We emailed dev@segments.io/)).toBeInTheDocument();
    expect(screen.queryByText("Invite link")).not.toBeInTheDocument();
  });

  it("shows the invite link before the setup link on self-hosted", async () => {
    m.selfHosted = true;
    await sendInvite();
    expect(screen.queryByText(/We emailed/)).not.toBeInTheDocument();
    expect(
      screen.getByText(/invite link to join the project first/)
    ).toBeInTheDocument();
    expect(screen.getByText("Invite link")).toBeInTheDocument();
    expect(screen.getByText("https://app.test/invite/abc")).toBeInTheDocument();
    expect(screen.getByText("https://app.test/setup")).toBeInTheDocument();
  });
});
