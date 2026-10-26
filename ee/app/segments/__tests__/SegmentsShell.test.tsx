import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SegmentsShell from "../SegmentsShell";

const selection = vi.hoisted(() => ({
  selectedInstance: undefined as
    | { id: string; production: { id: string }; test: { id: string } }
    | undefined,
  projectType: "Production",
}));

vi.mock("@/lib/edition", () => ({ IS_ENTERPRISE: true }));
vi.mock("@/components/layout/app-header", () => ({
  default: () => <header aria-label="App header" />,
}));
vi.mock("@/context/useProjectSelection", () => ({
  useProjectSelection: () => selection,
}));

describe("SegmentsShell", () => {
  it("shows a skeleton, not a select-a-project notice, while projects load", () => {
    selection.selectedInstance = undefined;
    render(<SegmentsShell title="Segments">{() => <p>page</p>}</SegmentsShell>);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
    expect(screen.queryByText(/Select a project/)).toBeNull();
    expect(screen.queryByText("page")).toBeNull();
  });

  it("renders the page once a project is selected", () => {
    selection.selectedInstance = {
      id: "i1",
      production: { id: "p1" },
      test: { id: "t1" },
    };
    render(
      <SegmentsShell title="Segments">
        {({ projectId }) => <p>page {projectId}</p>}
      </SegmentsShell>
    );
    expect(screen.getByText("page p1")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Loading" })).toBeNull();
  });
});
