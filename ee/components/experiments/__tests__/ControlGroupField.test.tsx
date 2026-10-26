import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ControlGroupField from "../ControlGroupField";

const settings = vi.hoisted(() => ({
  data: { control_group: 5 } as { control_group: number } | undefined,
}));

vi.mock("@ee/hooks/queries/useInAppQueries", () => ({
  useInAppSettingsQuery: () => settings,
}));

describe("ControlGroupField", () => {
  it("names the project-wide group next to the campaign's own, with a way to change it", () => {
    render(<ControlGroupField projectId="p1" value={10} onChange={() => {}} />);
    expect(
      screen.getByText(
        /Separately, 5% of everyone is held back from all messages project-wide/
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Change" })).toHaveAttribute(
      "href",
      "/engagement_settings"
    );
  });

  it("says when no one is held back project-wide", () => {
    settings.data = { control_group: 0 };
    render(
      <ControlGroupField projectId="p1" value={null} onChange={() => {}} />
    );
    expect(
      screen.getByText(/No one is held back project-wide/)
    ).toBeInTheDocument();
  });

  it("shows nothing about the project without a project", () => {
    render(<ControlGroupField value={null} onChange={() => {}} />);
    expect(screen.queryByText(/project-wide/)).toBeNull();
  });
});
